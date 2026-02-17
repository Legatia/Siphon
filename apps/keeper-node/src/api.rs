use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;

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
        .route("/api/attest-all", post(attest_all_shards))
        .layer(CorsLayer::permissive())
        .with_state(state)
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

#[derive(Deserialize)]
struct ExecuteRequest {
    task: String,
    max_turns: Option<u32>,
    turn_timeout: Option<u64>,
}

#[derive(Serialize)]
struct ExecuteResponse {
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
async fn execute_task(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    Json(body): Json<ExecuteRequest>,
) -> impl IntoResponse {
    let st = state.read().await;

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

    // Check execution state
    if shard.execution_state != crate::shard::ExecutionState::Idle {
        return Err(err_json(
            StatusCode::CONFLICT,
            format!("Shard is currently {:?}", shard.execution_state),
        ));
    }

    // Set shard to executing
    shard.execution_state = crate::shard::ExecutionState::Executing;
    let _ = db::update_shard(&st.config.data_dir, &shard);

    // Log the action
    let action_id = db::insert_action(&st.config.data_dir, &id, &body.task).unwrap_or(0);

    let api_key = st.config.openai_api_key.as_deref().unwrap_or("");
    let inference_config = inference::InferenceConfig {
        api_key: api_key.to_string(),
        api_url: st.config.inference_url.clone(),
        model: st.config.inference_model.clone(),
        max_tokens: 1024,
        temperature: 0.3,
    };

    // Build execution prompt
    let exec_prompt = format!(
        "{}\n\nYou are executing a task for your keeper. Use the available tools to complete the task. \
         Be precise and efficient. Return your final answer after tool execution.",
        shard.personality
    );

    // Filter tools based on shard capabilities
    let allowed = shard.capabilities.allowed_tools();
    let tools: Vec<_> = inference::shard_tool_definitions()
        .into_iter()
        .filter(|t| allowed.contains(&t.function.name.as_str()))
        .collect();

    // Configure and run the multi-turn agent loop
    let loop_config = agent_loop::AgentLoopConfig {
        max_turns: body.max_turns.unwrap_or(5),
        turn_timeout_secs: body.turn_timeout.unwrap_or(60),
    };

    let loop_result = agent_loop::run_agent_loop(
        &inference_config,
        &exec_prompt,
        &body.task,
        &tools,
        &loop_config,
        &st.config.data_dir,
        &id,
    )
    .await;

    let tool_results = &loop_result.all_tool_results;
    let all_success = loop_result.all_success;

    // Award XP based on execution outcome
    let xp_gained = if all_success && !tool_results.is_empty() {
        20 + (tool_results.len() as u32 * 5)
    } else if all_success {
        10 // text-only response
    } else {
        5 // partial failure
    };

    shard.xp += xp_gained as u64;
    shard.level = (shard.xp / 100) as u32 + 1;
    shard.last_interaction = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    // Stat progression: boost stats based on tool used
    let stat_bonuses = if !tool_results.is_empty() {
        let bonuses = compute_stat_bonuses(tool_results);
        apply_stat_bonuses(&mut shard, &bonuses);
        Some(serde_json::to_string(&bonuses).unwrap_or_default())
    } else {
        None
    };

    // Update task counters and execution state
    if all_success {
        shard.tasks_completed += 1;
    } else {
        shard.tasks_failed += 1;
    }
    shard.execution_state = crate::shard::ExecutionState::Idle;

    // Update capabilities based on new level
    shard.capabilities.update_for_level(shard.level);

    // Persist
    let _ = db::update_shard(&st.config.data_dir, &shard);

    // Complete the action log — store turn history as tool_output
    let status = if all_success { "success" } else { "failed" };
    let turn_json = serde_json::to_string(&loop_result.turns).unwrap_or_default();
    let first_tool = tool_results.first().map(|t| t.tool_name.as_str()).unwrap_or("none");
    let _ = db::complete_action(
        &st.config.data_dir,
        action_id,
        first_tool,
        &body.task,
        &turn_json,
        status,
        xp_gained,
        stat_bonuses.as_deref(),
    );

    tracing::info!(
        "HTTP: Executed task for shard {} — {} turns, {} tool calls, {} XP, {:?}",
        &id[..8.min(id.len())],
        loop_result.turns.len(),
        loop_result.total_tool_calls,
        xp_gained,
        loop_result.stop_reason
    );

    Ok(Json(ExecuteResponse {
        shard_id: id,
        task: body.task,
        turns: loop_result.turns,
        stop_reason: loop_result.stop_reason,
        final_response: loop_result.final_response,
        tool_results: loop_result.all_tool_results,
        xp_gained,
        new_xp: shard.xp,
        new_level: shard.level,
        action_id,
    }))
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
