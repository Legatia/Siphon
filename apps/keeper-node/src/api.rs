use axum::{
    extract::{Path, State},
    http::StatusCode,
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use uuid::Uuid;

use crate::agent_loop;
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
        .route("/api/shards/{id}/execute", post(execute_task))
        .route("/api/shards/{id}/actions", get(get_actions))
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
/// When no api_key is configured, all requests pass through (open mode).
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
    if let Some(ref expected_key) = st.config.api_key {
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

/// Execute a task using tool-calling inference. The shard decides which tools to use.
/// When `background: true`, returns a job ID immediately for async polling via GET /api/jobs/{id}.
/// Supports per-request inference overrides (inference_url, inference_model, inference_api_key).
async fn execute_task(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    Json(body): Json<ExecuteRequest>,
) -> Response {
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

    let exec_prompt = format!(
        "{}\n\nYou are executing a task for your keeper. Use the available tools to complete the task. \
         Be precise and efficient. Return your final answer after tool execution.",
        shard.personality
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

    tracing::info!(
        "Executed task for shard {} — {} turns, {} tool calls, {} XP, {:?}",
        &shard_id[..8.min(shard_id.len())],
        loop_result.turns.len(),
        loop_result.total_tool_calls,
        xp_gained,
        loop_result.stop_reason
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
