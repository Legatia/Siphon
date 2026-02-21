use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path as FsPath;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use uuid::Uuid;

use crate::agent_loop;
use crate::capture;
use crate::chain;
use crate::config::Config;
use crate::db;
use crate::executor;
use crate::inference;
use crate::monitor;
use crate::shard::Shard;

/// Shared application state for all HTTP handlers.
pub struct AppState {
    pub config: Config,
    pub jobs: HashMap<String, Job>,
}

pub type SharedState = Arc<RwLock<AppState>>;

/// Build the axum router with all API routes and CORS.
pub fn router(state: SharedState) -> Router {
    Router::new()
        .route("/api/status", get(get_status))
        .route("/api/shards", get(list_shards))
        .route("/api/shards/spawn", post(spawn_shard))
        .route("/api/shards/{id}", get(get_shard))
        .route("/api/shards/{id}", delete(delete_shard))
        .route("/api/shards/{id}/train", post(train_shard))
        .route("/api/shards/{id}/train", get(get_train_history))
        .route("/api/shards/{id}/capture", post(capture_shard))
        .route("/api/shards/{id}/execute", post(execute_task))
        .route("/api/shards/{id}/actions", get(get_actions))
        .route("/api/shards/{id}/lessons", get(get_lessons))
        .route("/api/shards/{id}/lesson-retrievals", get(get_lesson_retrievals))
        .route("/api/shards/{id}/attest", post(attest_shard))
        .route("/api/shards/{id}/register", post(register_shard_handler))
        .route("/api/shards/{id}/release", post(release_shard_handler))
        .route("/api/attest-all", post(attest_all_shards))
        .route("/api/jobs/{id}", get(get_job))
        .route_layer(middleware::from_fn_with_state(state.clone(), auth_middleware))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

// ── Auth middleware ─────────────────────────────────────────────────

/// Bearer token auth middleware. Skips /api/status for health checks.
/// Requires api_key to be configured; refuses open mode for safety.
async fn auth_middleware(
    State(state): State<SharedState>,
    request: axum::http::Request<axum::body::Body>,
    next: Next,
) -> Response {
    // Skip auth for health check endpoint
    if request.uri().path() == "/api/status" {
        return next.run(request).await;
    }

    let st = state.read().await;
    let Some(ref expected_key) = st.config.api_key else {
        drop(st);
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ErrorResponse {
                error: "API key is not configured. Refusing open mode; set api_key in keeper config."
                    .into(),
            }),
        )
            .into_response();
    };

    let auth_ok = request
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.starts_with("Bearer ") && &v[7..] == expected_key.as_str())
        .unwrap_or(false);

    if !auth_ok {
        drop(st);
        return (
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: "Invalid or missing API key. Set Authorization: Bearer <key>".into(),
            }),
        )
            .into_response();
    }
    drop(st);
    next.run(request).await
}

// ── Response types ──────────────────────────────────────────────────

#[derive(Serialize)]
struct StatusResponse {
    status: &'static str,
    shard_count: usize,
    cpu_usage: f64,
    memory_used_mb: f64,
    memory_total_mb: f64,
    disk_free_gb: f64,
    uptime_secs: u64,
    http_port: u16,
}

#[derive(Deserialize)]
struct SpawnRequest {
    shard_type: Option<String>,
}

#[derive(Deserialize)]
struct TrainRequest {
    message: String,
}

#[derive(Deserialize)]
struct CaptureRequest {
    answer: Option<String>,
}

#[derive(Serialize)]
struct TrainResponse {
    response: String,
    xp_gained: u32,
    new_xp: u64,
    new_level: u32,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

fn err_json(status: StatusCode, msg: impl Into<String>) -> (StatusCode, Json<ErrorResponse>) {
    (status, Json(ErrorResponse { error: msg.into() }))
}

// ── Job types (async execution) ─────────────────────────────────────

#[derive(Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Running,
    Completed,
    Failed,
}

#[derive(Clone, Serialize)]
pub struct Job {
    pub id: String,
    pub shard_id: String,
    pub task: String,
    pub status: JobStatus,
    pub result: Option<ExecuteResponse>,
    pub error: Option<String>,
    pub created_at: u64,
}

#[derive(Serialize)]
struct JobResponse {
    job_id: String,
    status: String,
}

// ── Handlers ────────────────────────────────────────────────────────

async fn get_status(State(state): State<SharedState>) -> impl IntoResponse {
    let st = state.read().await;
    let stats = monitor::get_system_stats();

    let shards = db::get_shards(&st.config.data_dir).unwrap_or_default();

    Json(StatusResponse {
        status: "ok",
        shard_count: shards.len(),
        cpu_usage: stats.cpu_usage,
        memory_used_mb: stats.memory_used_mb,
        memory_total_mb: stats.memory_total_mb,
        disk_free_gb: stats.disk_free_gb,
        uptime_secs: stats.uptime_secs,
        http_port: st.config.http_port,
    })
}

async fn list_shards(State(state): State<SharedState>) -> impl IntoResponse {
    let st = state.read().await;
    match db::get_shards(&st.config.data_dir) {
        Ok(shards) => Ok(Json(shards)),
        Err(e) => Err(err_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to read shards: {}", e),
        )),
    }
}

async fn spawn_shard(
    State(state): State<SharedState>,
    Json(body): Json<SpawnRequest>,
) -> impl IntoResponse {
    let st = state.read().await;
    let new_shard = Shard::spawn(body.shard_type.as_deref());

    if let Err(e) = db::insert_shard(&st.config.data_dir, &new_shard) {
        return Err(err_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to persist shard: {}", e),
        ));
    }

    tracing::info!(
        "HTTP: Spawned shard {} [{}]",
        new_shard.name,
        new_shard.shard_type
    );

    Ok((StatusCode::CREATED, Json(new_shard)))
}

async fn get_shard(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let st = state.read().await;
    match db::get_shard_by_id(&st.config.data_dir, &id) {
        Ok(Some(shard)) => Ok(Json(shard)),
        Ok(None) => Err(err_json(StatusCode::NOT_FOUND, "Shard not found")),
        Err(e) => Err(err_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("DB error: {}", e),
        )),
    }
}

async fn delete_shard(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let st = state.read().await;

    // Verify shard exists
    match db::get_shard_by_id(&st.config.data_dir, &id) {
        Ok(Some(_)) => {}
        Ok(None) => return Err(err_json(StatusCode::NOT_FOUND, "Shard not found")),
        Err(e) => {
            return Err(err_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("DB error: {}", e),
            ))
        }
    }

    if let Err(e) = db::delete_shard(&st.config.data_dir, &id) {
        return Err(err_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to delete shard: {}", e),
        ));
    }

    tracing::info!("HTTP: Deleted shard {}", &id[..8.min(id.len())]);
    Ok(StatusCode::NO_CONTENT)
}

async fn train_shard(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    Json(body): Json<TrainRequest>,
) -> impl IntoResponse {
    let st = state.read().await;

    // Look up shard
    let mut shard = match db::get_shard_by_id(&st.config.data_dir, &id) {
        Ok(Some(s)) => s,
        Ok(None) => return Err(err_json(StatusCode::NOT_FOUND, "Shard not found")),
        Err(e) => {
            return Err(err_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("DB error: {}", e),
            ))
        }
    };

    // Get recent history for context
    let history_rows = db::get_interactions(&st.config.data_dir, &id, 20).unwrap_or_default();
    let history: Vec<inference::ChatMessage> = history_rows
        .iter()
        .map(|i| inference::ChatMessage::text(&i.role, &i.content))
        .collect();

    let api_key = st.config.openai_api_key.as_deref().unwrap_or("");

    // Generate AI response
    let ai_response = inference::generate_shard_response(
        api_key,
        &st.config.inference_url,
        &st.config.inference_model,
        &shard.personality,
        &body.message,
        &history,
    )
    .await
    .map_err(|e| err_json(StatusCode::BAD_GATEWAY, format!("Inference failed: {}", e)))?;

    // Award XP
    let xp_gained = 10 + (body.message.split_whitespace().count() as u32).min(40);
    shard.xp += xp_gained as u64;

    // Level up every 100 XP
    let new_level = (shard.xp / 100) as u32 + 1;
    shard.level = new_level;

    // Update last interaction timestamp
    shard.last_interaction = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    // Persist
    let _ = db::update_shard(&st.config.data_dir, &shard);
    let _ = db::insert_interaction(&st.config.data_dir, &id, "user", &body.message, 0);
    let _ = db::insert_interaction(&st.config.data_dir, &id, "assistant", &ai_response, xp_gained);

    Ok(Json(TrainResponse {
        response: ai_response,
        xp_gained,
        new_xp: shard.xp,
        new_level: shard.level,
    }))
}

async fn capture_shard(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    Json(body): Json<CaptureRequest>,
) -> impl IntoResponse {
    let st = state.read().await;
    let shard = match db::get_shard_by_id(&st.config.data_dir, &id) {
        Ok(Some(s)) => s,
        Ok(None) => return Err(err_json(StatusCode::NOT_FOUND, "Shard not found")),
        Err(e) => {
            return Err(err_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("DB error: {}", e),
            ))
        }
    };
    drop(st);

    let challenge = capture::generate_challenge(&shard);
    if let Some(answer) = body.answer {
        let result = capture::evaluate_answer(&challenge, &answer);
        return Ok(Json(serde_json::json!({
            "challenge": challenge,
            "result": result
        })));
    }

    Ok(Json(serde_json::json!({ "challenge": challenge })))
}

async fn get_train_history(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let st = state.read().await;

    // Verify shard exists
    match db::get_shard_by_id(&st.config.data_dir, &id) {
        Ok(Some(_)) => {}
        Ok(None) => return Err(err_json(StatusCode::NOT_FOUND, "Shard not found")),
        Err(e) => {
            return Err(err_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("DB error: {}", e),
            ))
        }
    }

    match db::get_interactions(&st.config.data_dir, &id, 100) {
        Ok(interactions) => Ok(Json(interactions)),
        Err(e) => Err(err_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to read interactions: {}", e),
        )),
    }
}

// ── Execute (task execution with tool calling) ─────────────────────

#[derive(Deserialize, Clone)]
struct ExecuteRequest {
    task: String,
    max_turns: Option<u32>,
    turn_timeout: Option<u64>,
    /// Per-request inference URL override (e.g., Ollama, custom endpoint)
    #[serde(default)]
    inference_url: Option<String>,
    /// Per-request model override
    #[serde(default)]
    inference_model: Option<String>,
    /// Per-request API key override
    #[serde(default)]
    inference_api_key: Option<String>,
    /// Run in background and return a job ID for polling (default: false = blocking)
    #[serde(default)]
    background: bool,
}

#[derive(Clone, Serialize)]
pub(crate) struct ExecuteResponse {
    shard_id: String,
    task: String,
    turns: Vec<agent_loop::Turn>,
    stop_reason: agent_loop::StopReason,
    final_response: Option<String>,
    tool_results: Vec<executor::ToolResult>,
    xp_gained: u32,
    new_xp: u64,
    new_level: u32,
    action_id: i64,
}

#[derive(Serialize)]
struct MemoryArtifact {
    schema_version: String,
    lesson_type: String,
    shard_id: String,
    action_id: i64,
    task_type: String,
    goal: String,
    approach: String,
    tools_used: Vec<String>,
    outcome: String,
    errors: Vec<String>,
    fixes: Vec<String>,
    duration_ms: u64,
    success: bool,
    extractor_confidence: f64,
    applicability_confidence: f64,
    reusability: f64,
    retrieved_lesson_ids: Vec<i64>,
    created_at: u64,
}

/// Execute a task using tool-calling inference. The shard decides which tools to use.
/// When `background: true`, returns a job ID immediately for async polling via GET /api/jobs/{id}.
/// Supports per-request inference overrides (inference_url, inference_model, inference_api_key).
async fn execute_task(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(body): Json<ExecuteRequest>,
) -> Response {
    let requester_owner = headers
        .get("x-owner-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim().to_ascii_lowercase());

    // Validate shard exists and is idle
    let (shard, data_dir, inference_config) = {
        let st = state.read().await;

        let mut shard = match db::get_shard_by_id(&st.config.data_dir, &id) {
            Ok(Some(s)) => s,
            Ok(None) => return err_json(StatusCode::NOT_FOUND, "Shard not found").into_response(),
            Err(e) => {
                return err_json(StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {}", e))
                    .into_response()
            }
        };

        if shard.execution_state != crate::shard::ExecutionState::Idle {
            return err_json(
                StatusCode::CONFLICT,
                format!("Shard is currently {:?}", shard.execution_state),
            )
            .into_response();
        }

        // Enforce shard-owner hard gate for execution.
        if let Some(owner_id) = shard.owner_id.as_ref() {
            let owner = owner_id.to_ascii_lowercase();
            if requester_owner.as_deref() != Some(owner.as_str()) {
                return err_json(
                    StatusCode::FORBIDDEN,
                    "x-owner-id header must match shard owner for execute",
                )
                .into_response();
            }
        }

        shard.execution_state = crate::shard::ExecutionState::Executing;
        let _ = db::update_shard(&st.config.data_dir, &shard);

        // Build inference config with per-request overrides
        let api_key = body
            .inference_api_key
            .as_deref()
            .or(st.config.openai_api_key.as_deref())
            .unwrap_or("")
            .to_string();
        let api_url = body
            .inference_url
            .clone()
            .unwrap_or_else(|| st.config.inference_url.clone());
        let model = body
            .inference_model
            .clone()
            .unwrap_or_else(|| st.config.inference_model.clone());

        let inference_config = inference::InferenceConfig {
            api_key,
            api_url,
            model,
            max_tokens: 1024,
            temperature: 0.3,
        };

        (shard, st.config.data_dir.clone(), inference_config)
    };

    let shard_id = id.clone();
    let task = body.task.clone();

    if body.background {
        // ── Async mode: return job ID immediately ────────────────────
        let job_id = Uuid::new_v4().to_string();
        let job = Job {
            id: job_id.clone(),
            shard_id: shard_id.clone(),
            task: task.clone(),
            status: JobStatus::Running,
            result: None,
            error: None,
            created_at: now_millis(),
        };

        {
            let mut st = state.write().await;
            st.jobs.insert(job_id.clone(), job);
        }

        let state_clone = state.clone();
        let job_id_clone = job_id.clone();
        let body_clone = body.clone();

        tokio::spawn(async move {
            let result = run_execution(
                &data_dir,
                shard,
                &shard_id,
                &body_clone,
                &inference_config,
            )
            .await;

            let mut st = state_clone.write().await;
            if let Some(job) = st.jobs.get_mut(&job_id_clone) {
                match result {
                    Ok(resp) => {
                        job.status = JobStatus::Completed;
                        job.result = Some(resp);
                    }
                    Err(e) => {
                        job.status = JobStatus::Failed;
                        job.error = Some(e);
                    }
                }
            }
        });

        return (
            StatusCode::ACCEPTED,
            Json(JobResponse {
                job_id,
                status: "running".into(),
            }),
        )
            .into_response();
    }

    // ── Sync mode: block until done ──────────────────────────────
    match run_execution(&data_dir, shard, &shard_id, &body, &inference_config).await {
        Ok(resp) => Json(resp).into_response(),
        Err(e) => err_json(StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

/// Core execution logic shared by sync and async paths.
async fn run_execution(
    data_dir: &str,
    mut shard: Shard,
    shard_id: &str,
    body: &ExecuteRequest,
    inference_config: &inference::InferenceConfig,
) -> Result<ExecuteResponse, String> {
    let action_id = db::insert_action(data_dir, shard_id, &body.task).unwrap_or(0);
    let task_type = infer_task_type(&body.task);
    let retrieved_lessons = retrieve_lessons_hybrid(
        data_dir,
        shard_id,
        &body.task,
        &task_type,
        inference_config,
    )
    .await;
    let retrieval_ids: Vec<i64> = retrieved_lessons.iter().map(|l| l.id).collect();
    let retrieval_event_id = if retrieval_ids.is_empty() {
        None
    } else {
        db::start_lesson_retrieval_event(
            data_dir,
            shard_id,
            action_id,
            &body.task,
            &task_type,
            &retrieval_ids,
        )
        .ok()
    };
    let memory_context = build_memory_context(&retrieved_lessons);

    let exec_prompt = format!(
        "{}\n\nYou are executing a task for your keeper. Use the available tools to complete the task. \
         Be precise and efficient. Return your final answer after tool execution.\n\n{}",
        shard.personality,
        memory_context
    );

    let allowed = shard.capabilities.allowed_tools();
    let tools: Vec<_> = inference::shard_tool_definitions()
        .into_iter()
        .filter(|t| allowed.contains(&t.function.name.as_str()))
        .collect();

    let loop_config = agent_loop::AgentLoopConfig {
        max_turns: body.max_turns.unwrap_or(5),
        turn_timeout_secs: body.turn_timeout.unwrap_or(60),
    };

    let loop_result = agent_loop::run_agent_loop(
        inference_config,
        &exec_prompt,
        &body.task,
        &tools,
        &loop_config,
        data_dir,
        shard_id,
    )
    .await;

    let tool_results = &loop_result.all_tool_results;
    let all_success = loop_result.all_success;
    let duration_ms = loop_result
        .turns
        .iter()
        .map(|t| t.duration_ms)
        .sum::<u64>();

    let xp_gained = if all_success && !tool_results.is_empty() {
        20 + (tool_results.len() as u32 * 5)
    } else if all_success {
        10
    } else {
        5
    };

    shard.xp += xp_gained as u64;
    shard.level = (shard.xp / 100) as u32 + 1;
    shard.last_interaction = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let stat_bonuses = if !tool_results.is_empty() {
        let bonuses = compute_stat_bonuses(tool_results);
        apply_stat_bonuses(&mut shard, &bonuses);
        Some(serde_json::to_string(&bonuses).unwrap_or_default())
    } else {
        None
    };

    if all_success {
        shard.tasks_completed += 1;
    } else {
        shard.tasks_failed += 1;
    }
    shard.execution_state = crate::shard::ExecutionState::Idle;
    shard.capabilities.update_for_level(shard.level);

    let _ = db::update_shard(data_dir, &shard);

    let status = if all_success { "success" } else { "failed" };
    let turn_json = serde_json::to_string(&loop_result.turns).unwrap_or_default();
    let first_tool = tool_results
        .first()
        .map(|t| t.tool_name.as_str())
        .unwrap_or("none");
    let _ = db::complete_action(
        data_dir,
        action_id,
        first_tool,
        &body.task,
        &turn_json,
        status,
        xp_gained,
        stat_bonuses.as_deref(),
    );

    let tools_used = unique_tool_names(tool_results);
    let approach = summarize_approach(&loop_result, &tools_used);
    let errors = collect_errors(tool_results);
    let fixes = collect_fixes(tool_results, !errors.is_empty(), all_success);
    let outcome = loop_result
        .final_response
        .clone()
        .unwrap_or_else(|| format!("Stopped: {:?}", loop_result.stop_reason));
    let extractor_confidence = estimate_extractor_confidence(&approach, &outcome, &tools_used, &errors);
    let applicability_confidence = estimate_applicability_confidence(all_success, &task_type, &tools_used);
    let reusability = estimate_reusability(all_success, &tools_used, &errors, &fixes);
    let goal = truncate(&body.task, 280);
    let created_at = now_millis();

    let artifact = MemoryArtifact {
        schema_version: "task-lesson.v1".to_string(),
        lesson_type: "post_task_lesson".to_string(),
        shard_id: shard_id.to_string(),
        action_id,
        task_type: task_type.clone(),
        goal: goal.clone(),
        approach: approach.clone(),
        tools_used: tools_used.clone(),
        outcome: truncate(&outcome, 900),
        errors: errors.clone(),
        fixes: fixes.clone(),
        duration_ms,
        success: all_success,
        extractor_confidence,
        applicability_confidence,
        reusability,
        retrieved_lesson_ids: retrieval_ids.clone(),
        created_at,
    };

    let artifact_path = match validate_memory_artifact(&artifact)
        .and_then(|_| write_memory_artifact(data_dir, shard_id, action_id, created_at, &artifact))
    {
        Ok(path) => path,
        Err(err) => {
            tracing::warn!("Memory artifact write skipped: {}", err);
            format!("memory://write_failed/{}", action_id)
        }
    };

    let lesson = db::NewTaskLesson {
        shard_id,
        action_id,
        task_type: &task_type,
        goal: &goal,
        approach: &approach,
        tools_used: &tools_used,
        outcome: &outcome,
        errors: &errors,
        fixes: &fixes,
        duration_ms,
        success: all_success,
        extractor_confidence,
        applicability_confidence,
        reusability,
        artifact_path: &artifact_path,
    };
    let _ = db::insert_task_lesson(data_dir, &lesson);

    if !retrieval_ids.is_empty() {
        let baseline = db::avg_success_duration_by_task_type(data_dir, shard_id, &task_type).ok().flatten();
        let latency_delta_ms = baseline.map(|b| duration_ms as i64 - b as i64);
        let helpful = all_success && latency_delta_ms.map(|d| d <= 0).unwrap_or(true);
        let _ = db::apply_lesson_feedback(data_dir, &retrieval_ids, helpful);
        if let Some(event_id) = retrieval_event_id {
            let _ = db::complete_lesson_retrieval_event(
                data_dir,
                event_id,
                all_success,
                duration_ms,
                latency_delta_ms,
                helpful,
            );
        }
    }

    tracing::info!(
        "Executed task for shard {} — {} turns, {} tool calls, {} XP, {:?} ({} lessons retrieved)",
        &shard_id[..8.min(shard_id.len())],
        loop_result.turns.len(),
        loop_result.total_tool_calls,
        xp_gained,
        loop_result.stop_reason,
        retrieval_ids.len()
    );

    Ok(ExecuteResponse {
        shard_id: shard_id.to_string(),
        task: body.task.clone(),
        turns: loop_result.turns,
        stop_reason: loop_result.stop_reason,
        final_response: loop_result.final_response,
        tool_results: loop_result.all_tool_results,
        xp_gained,
        new_xp: shard.xp,
        new_level: shard.level,
        action_id,
    })
}

/// Compute stat bonuses based on which tools were used successfully.
fn compute_stat_bonuses(results: &[executor::ToolResult]) -> std::collections::HashMap<String, u32> {
    let mut bonuses = std::collections::HashMap::new();

    for result in results {
        if !result.success {
            continue;
        }
        match result.tool_name.as_str() {
            "code_eval" => {
                *bonuses.entry("intelligence".to_string()).or_insert(0) += 1;
                *bonuses.entry("precision".to_string()).or_insert(0) += 1;
            }
            "http_fetch" => {
                *bonuses.entry("intelligence".to_string()).or_insert(0) += 1;
            }
            "file_read" | "file_write" => {
                *bonuses.entry("precision".to_string()).or_insert(0) += 1;
            }
            "shell_exec" => {
                *bonuses.entry("resilience".to_string()).or_insert(0) += 1;
                *bonuses.entry("precision".to_string()).or_insert(0) += 1;
            }
            _ => {}
        }
    }

    bonuses
}

/// Apply stat bonuses to a shard (mutates in place).
fn apply_stat_bonuses(shard: &mut Shard, bonuses: &std::collections::HashMap<String, u32>) {
    for (stat, bonus) in bonuses {
        match stat.as_str() {
            "intelligence" => shard.stats.intelligence += bonus,
            "creativity" => shard.stats.creativity += bonus,
            "precision" => shard.stats.precision += bonus,
            "resilience" => shard.stats.resilience += bonus,
            "charisma" => shard.stats.charisma += bonus,
            _ => {}
        }
    }
}

fn infer_task_type(task: &str) -> String {
    let t = task.to_ascii_lowercase();
    if t.contains("debug") || t.contains("fix") || t.contains("error") || t.contains("bug") {
        "debug".to_string()
    } else if t.contains("write") || t.contains("copy") || t.contains("draft") || t.contains("content") {
        "writing".to_string()
    } else if t.contains("research") || t.contains("analyze") || t.contains("compare") {
        "analysis".to_string()
    } else if t.contains("build") || t.contains("implement") || t.contains("code") || t.contains("refactor") {
        "coding".to_string()
    } else {
        "general".to_string()
    }
}

async fn retrieve_lessons_hybrid(
    data_dir: &str,
    shard_id: &str,
    task: &str,
    task_type: &str,
    inference_config: &inference::InferenceConfig,
) -> Vec<db::TaskLesson> {
    // Coarse prefilter keeps embedding cost bounded and favors fresh/high-value lessons.
    let candidates = db::retrieve_relevant_lessons(data_dir, shard_id, task, task_type, 40)
        .unwrap_or_default();
    if candidates.is_empty() {
        return vec![];
    }

    let query_tokens = tokenize(task);
    let query_text = format!("{} :: {}", task_type, task);
    let lesson_texts: Vec<String> = candidates
        .iter()
        .map(lesson_embedding_text)
        .collect();
    let mut embedding_inputs = Vec::with_capacity(lesson_texts.len() + 1);
    embedding_inputs.push(query_text);
    embedding_inputs.extend(lesson_texts);

    let semantic_vectors = inference::embed_texts(inference_config, &embedding_inputs).await;
    let mut ranked: Vec<(db::TaskLesson, f64)> = match semantic_vectors {
        Ok(vectors) if vectors.len() == candidates.len() + 1 => {
            let query_vec = vectors[0].clone();
            candidates
                .into_iter()
                .zip(vectors.into_iter().skip(1))
                .map(|(lesson, vec)| {
                    let score = hybrid_rank(&lesson, &query_tokens, &query_vec, &vec, task_type);
                    (lesson, score)
                })
                .collect()
        }
        Ok(_) | Err(_) => {
            // Fallback: preserve lexical ranking order from DB prefilter.
            candidates
                .into_iter()
                .enumerate()
                .map(|(idx, lesson)| (lesson, 1.0 - (idx as f64 * 0.01)))
                .collect()
        }
    };

    ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let mut selected = Vec::new();
    for (lesson, score) in ranked {
        if selected.len() >= 7 {
            break;
        }
        if selected.len() >= 3 && score < 0.18 {
            break;
        }
        if selected.iter().any(|s| near_duplicate_lessons(s, &lesson)) {
            continue;
        }
        selected.push(lesson);
    }
    selected
}

fn lesson_embedding_text(lesson: &db::TaskLesson) -> String {
    format!(
        "type={} goal={} approach={} outcome={} errors={} fixes={}",
        lesson.task_type,
        lesson.goal,
        lesson.approach,
        lesson.outcome,
        lesson.errors.join(" | "),
        lesson.fixes.join(" | ")
    )
}

fn hybrid_rank(
    lesson: &db::TaskLesson,
    query_tokens: &[String],
    query_embedding: &[f32],
    lesson_embedding: &[f32],
    task_type: &str,
) -> f64 {
    let semantic = ((cosine_similarity(query_embedding, lesson_embedding) + 1.0) / 2.0)
        .clamp(0.0, 1.0);
    let lexical = jaccard_similarity(
        query_tokens,
        &tokenize(&format!("{} {} {}", lesson.goal, lesson.approach, lesson.outcome)),
    );
    let type_boost = if lesson.task_type == task_type { 0.08 } else { 0.0 };
    let helpful_rate = (lesson.times_helpful as f64 + 1.0)
        / (lesson.times_retrieved as f64 + 2.0);
    (semantic * 0.55 + lexical * 0.20 + lesson.score * 0.17 + helpful_rate * 0.08 + type_boost)
        .clamp(0.0, 1.0)
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f64 {
    if a.is_empty() || b.is_empty() || a.len() != b.len() {
        return 0.0;
    }
    let mut dot = 0.0f64;
    let mut na = 0.0f64;
    let mut nb = 0.0f64;
    for (x, y) in a.iter().zip(b.iter()) {
        let xf = *x as f64;
        let yf = *y as f64;
        dot += xf * yf;
        na += xf * xf;
        nb += yf * yf;
    }
    if na == 0.0 || nb == 0.0 {
        0.0
    } else {
        dot / (na.sqrt() * nb.sqrt())
    }
}

fn tokenize(input: &str) -> Vec<String> {
    input
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| t.len() >= 3)
        .map(|t| t.to_ascii_lowercase())
        .collect()
}

fn jaccard_similarity(a: &[String], b: &[String]) -> f64 {
    if a.is_empty() || b.is_empty() {
        return 0.0;
    }
    let a_set: std::collections::HashSet<&str> = a.iter().map(|s| s.as_str()).collect();
    let b_set: std::collections::HashSet<&str> = b.iter().map(|s| s.as_str()).collect();
    let inter = a_set.intersection(&b_set).count() as f64;
    let union = a_set.union(&b_set).count() as f64;
    if union == 0.0 { 0.0 } else { inter / union }
}

fn near_duplicate_lessons(a: &db::TaskLesson, b: &db::TaskLesson) -> bool {
    if a.task_type != b.task_type {
        return false;
    }
    let ta = tokenize(&format!("{} {}", a.goal, a.approach));
    let tb = tokenize(&format!("{} {}", b.goal, b.approach));
    jaccard_similarity(&ta, &tb) >= 0.82
}

fn build_memory_context(lessons: &[db::TaskLesson]) -> String {
    if lessons.is_empty() {
        return "No prior task lessons available.".to_string();
    }
    let take = lessons.len().min(7);
    let mut lines = Vec::with_capacity(take + 2);
    lines.push(format!(
        "Prior lessons (distilled, use only if relevant; max {}):",
        take
    ));
    for lesson in lessons.iter().take(take) {
        let errors = if lesson.errors.is_empty() {
            "none".to_string()
        } else {
            truncate(&lesson.errors.join(" | "), 140)
        };
        lines.push(format!(
            "- [{}] type={} success={} score={:.2}; approach: {}; avoid: {}",
            lesson.id,
            lesson.task_type,
            lesson.success,
            lesson.score,
            truncate(&lesson.approach, 140),
            errors
        ));
    }
    lines.join("\n")
}

fn unique_tool_names(results: &[executor::ToolResult]) -> Vec<String> {
    let mut out = Vec::new();
    for r in results {
        if !out.iter().any(|n| n == &r.tool_name) {
            out.push(r.tool_name.clone());
        }
    }
    out
}

fn summarize_approach(loop_result: &agent_loop::AgentLoopResult, tools_used: &[String]) -> String {
    if tools_used.is_empty() {
        return format!(
            "Completed in {} turns without tool calls; stop_reason={:?}",
            loop_result.turns.len(),
            loop_result.stop_reason
        );
    }
    format!(
        "Completed in {} turns with {} tool calls using [{}]; stop_reason={:?}",
        loop_result.turns.len(),
        loop_result.total_tool_calls,
        tools_used.join(", "),
        loop_result.stop_reason
    )
}

fn collect_errors(results: &[executor::ToolResult]) -> Vec<String> {
    results
        .iter()
        .filter(|r| !r.success)
        .take(3)
        .map(|r| format!("{}: {}", r.tool_name, truncate(&r.output, 220)))
        .collect()
}

fn collect_fixes(
    results: &[executor::ToolResult],
    had_errors: bool,
    all_success: bool,
) -> Vec<String> {
    let mut fixes = Vec::new();
    if had_errors {
        let successful: Vec<String> = results
            .iter()
            .filter(|r| r.success)
            .map(|r| r.tool_name.clone())
            .collect();
        if !successful.is_empty() {
            fixes.push(format!(
                "Recovered by switching to successful tools: {}",
                successful.join(", ")
            ));
        }
    }
    if all_success && fixes.is_empty() {
        fixes.push("Execution completed without tool-level failures.".to_string());
    }
    fixes
}

fn estimate_extractor_confidence(
    approach: &str,
    outcome: &str,
    tools_used: &[String],
    errors: &[String],
) -> f64 {
    let mut score: f64 = 0.35;
    if !approach.is_empty() {
        score += 0.2;
    }
    if !outcome.is_empty() {
        score += 0.2;
    }
    if !tools_used.is_empty() {
        score += 0.15;
    }
    if !errors.is_empty() {
        score += 0.1;
    }
    score.clamp(0.0, 1.0)
}

fn estimate_applicability_confidence(
    success: bool,
    task_type: &str,
    tools_used: &[String],
) -> f64 {
    let mut score: f64 = if success { 0.55 } else { 0.35 };
    if task_type != "general" {
        score += 0.2;
    }
    if !tools_used.is_empty() {
        score += 0.15;
    }
    score.clamp(0.0, 1.0)
}

fn estimate_reusability(
    success: bool,
    tools_used: &[String],
    errors: &[String],
    fixes: &[String],
) -> f64 {
    let mut score: f64 = if success { 0.55 } else { 0.3 };
    if !tools_used.is_empty() {
        score += 0.2;
    }
    if !errors.is_empty() && !fixes.is_empty() {
        score += 0.15;
    }
    score.clamp(0.0, 1.0)
}

fn truncate(input: &str, max: usize) -> String {
    if input.len() <= max {
        input.to_string()
    } else {
        format!("{}...", &input[..max])
    }
}

fn write_memory_artifact(
    data_dir: &str,
    shard_id: &str,
    action_id: i64,
    timestamp_ms: u64,
    artifact: &MemoryArtifact,
) -> Result<String, String> {
    let expanded = expand_path(data_dir);
    let dir = FsPath::new(&expanded)
        .join("memories")
        .join("tasks")
        .join(shard_id);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create memory dir: {}", e))?;
    let file = dir.join(format!("{}-{}.json", timestamp_ms, action_id));
    let body = serde_json::to_string_pretty(artifact)
        .map_err(|e| format!("Failed to serialize memory artifact: {}", e))?;
    std::fs::write(&file, body).map_err(|e| format!("Failed to write memory artifact: {}", e))?;
    Ok(file.to_string_lossy().to_string())
}

fn expand_path(path: &str) -> String {
    if path.starts_with("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return format!("{}{}", home, &path[1..]);
        }
    }
    path.to_string()
}

fn validate_memory_artifact(artifact: &MemoryArtifact) -> Result<(), String> {
    if artifact.schema_version != "task-lesson.v1" {
        return Err("Unsupported memory schema_version".to_string());
    }
    if artifact.task_type.trim().is_empty()
        || artifact.goal.trim().is_empty()
        || artifact.approach.trim().is_empty()
        || artifact.outcome.trim().is_empty()
    {
        return Err("Missing required artifact fields".to_string());
    }
    if !(0.0..=1.0).contains(&artifact.extractor_confidence)
        || !(0.0..=1.0).contains(&artifact.applicability_confidence)
        || !(0.0..=1.0).contains(&artifact.reusability)
    {
        return Err("Confidence/reusability values must be in [0,1]".to_string());
    }
    Ok(())
}

/// Get recent actions for a shard.
async fn get_actions(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let st = state.read().await;

    match db::get_shard_by_id(&st.config.data_dir, &id) {
        Ok(Some(_)) => {}
        Ok(None) => return Err(err_json(StatusCode::NOT_FOUND, "Shard not found")),
        Err(e) => {
            return Err(err_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("DB error: {}", e),
            ))
        }
    }

    match db::get_actions(&st.config.data_dir, &id, 50) {
        Ok(actions) => Ok(Json(actions)),
        Err(e) => Err(err_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to read actions: {}", e),
        )),
    }
}

/// Get recent lessons for a shard.
async fn get_lessons(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let st = state.read().await;

    match db::get_shard_by_id(&st.config.data_dir, &id) {
        Ok(Some(_)) => {}
        Ok(None) => return Err(err_json(StatusCode::NOT_FOUND, "Shard not found")),
        Err(e) => {
            return Err(err_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("DB error: {}", e),
            ))
        }
    }

    match db::get_recent_task_lessons(&st.config.data_dir, &id, 50) {
        Ok(lessons) => Ok(Json(lessons)),
        Err(e) => Err(err_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to read lessons: {}", e),
        )),
    }
}

/// Get recent lesson retrieval events for a shard (trajectory/impact debugging).
async fn get_lesson_retrievals(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let st = state.read().await;

    match db::get_shard_by_id(&st.config.data_dir, &id) {
        Ok(Some(_)) => {}
        Ok(None) => return Err(err_json(StatusCode::NOT_FOUND, "Shard not found")),
        Err(e) => {
            return Err(err_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("DB error: {}", e),
            ))
        }
    }

    match db::get_recent_lesson_retrieval_events(&st.config.data_dir, &id, 100) {
        Ok(events) => Ok(Json(events)),
        Err(e) => Err(err_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to read retrieval events: {}", e),
        )),
    }
}

fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

// ── Register shard on-chain ─────────────────────────────────────────

#[derive(Serialize)]
struct RegisterResponse {
    shard_id: String,
    genome_hash: String,
    tx_result: String,
}

/// Register a shard on-chain via the ShardRegistry contract.
async fn register_shard_handler(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> Response {
    let st = state.read().await;

    let shard = match db::get_shard_by_id(&st.config.data_dir, &id) {
        Ok(Some(s)) => s,
        Ok(None) => return err_json(StatusCode::NOT_FOUND, "Shard not found").into_response(),
        Err(e) => {
            return err_json(StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {}", e))
                .into_response()
        }
    };

    let tx_result = chain::register_shard(&st.config, &shard.id, &shard.genome_hash)
        .await
        .unwrap_or_else(|e| format!("Failed: {}", e));

    Json(RegisterResponse {
        shard_id: shard.id,
        genome_hash: shard.genome_hash,
        tx_result,
    })
    .into_response()
}

// ── Release shard to wild ───────────────────────────────────────────

#[derive(Serialize)]
struct ReleaseResponse {
    shard_id: String,
    is_wild: bool,
    tx_result: Option<String>,
}

/// Release a shard: set it to wild on-chain and update the local database.
async fn release_shard_handler(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> Response {
    let st = state.read().await;

    let mut shard = match db::get_shard_by_id(&st.config.data_dir, &id) {
        Ok(Some(s)) => s,
        Ok(None) => return err_json(StatusCode::NOT_FOUND, "Shard not found").into_response(),
        Err(e) => {
            return err_json(StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {}", e))
                .into_response()
        }
    };

    // Try on-chain setWild (may fail if shard not registered on-chain yet)
    let tx_result = match chain::set_wild(&st.config, &shard.genome_hash).await {
        Ok(msg) => Some(msg),
        Err(e) => {
            tracing::warn!("On-chain setWild failed (shard may not be registered): {}", e);
            None
        }
    };

    // Always update local DB
    shard.is_wild = true;
    shard.owner_id = None;
    let _ = db::update_shard(&st.config.data_dir, &shard);

    tracing::info!("Released shard {} to wild", &id[..8.min(id.len())]);

    Json(ReleaseResponse {
        shard_id: shard.id,
        is_wild: true,
        tx_result,
    })
    .into_response()
}

// ── Job polling ─────────────────────────────────────────────────────

/// Get the status and result of a background execution job.
async fn get_job(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> Response {
    let st = state.read().await;

    match st.jobs.get(&id) {
        Some(job) => Json(job.clone()).into_response(),
        None => err_json(StatusCode::NOT_FOUND, "Job not found").into_response(),
    }
}

// ── Attest ──────────────────────────────────────────────────────────

#[derive(Serialize)]
struct AttestResponse {
    shard_id: String,
    level: u32,
    elo: u32,
    stats_sum: u32,
    tx_result: String,
}

/// Attest a single shard's stats to the ShardValuation contract on-chain.
async fn attest_shard(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let st = state.read().await;

    let shard = match db::get_shard_by_id(&st.config.data_dir, &id) {
        Ok(Some(s)) => s,
        Ok(None) => return Err(err_json(StatusCode::NOT_FOUND, "Shard not found")),
        Err(e) => {
            return Err(err_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("DB error: {}", e),
            ))
        }
    };

    let stats_sum = shard.stats_sum();

    let tx_result = chain::attest_shard_value(
        &st.config,
        &shard.genome_hash,
        shard.level as u64,
        shard.elo_rating as u64,
        stats_sum as u64,
    )
    .await
    .unwrap_or_else(|e| format!("Failed: {}", e));

    Ok(Json(AttestResponse {
        shard_id: shard.id,
        level: shard.level,
        elo: shard.elo_rating,
        stats_sum,
        tx_result,
    }))
}

/// Attest all hosted shards' stats on-chain.
async fn attest_all_shards(State(state): State<SharedState>) -> impl IntoResponse {
    let st = state.read().await;
    let shards = db::get_shards(&st.config.data_dir).unwrap_or_default();

    let mut results = Vec::new();

    for shard in &shards {
        let stats_sum = shard.stats_sum();
        let tx_result = chain::attest_shard_value(
            &st.config,
            &shard.genome_hash,
            shard.level as u64,
            shard.elo_rating as u64,
            stats_sum as u64,
        )
        .await
        .unwrap_or_else(|e| format!("Failed: {}", e));

        results.push(AttestResponse {
            shard_id: shard.id.clone(),
            level: shard.level,
            elo: shard.elo_rating,
            stats_sum,
            tx_result,
        });
    }

    Json(results)
}
