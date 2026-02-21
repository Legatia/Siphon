use serde::{Deserialize, Serialize};
use tauri::State;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use siphon_keeper::{
    agent_loop::{self, AgentLoopConfig, AgentLoopResult},
    config::Config,
    executor,
    inference::{self, ChatMessage, InferenceConfig, ToolCall},
};

use crate::state::{self, AppState};

// ── Helper: build InferenceConfig from keeper Config ────────────────

fn inference_config_from(cfg: &Config) -> InferenceConfig {
    InferenceConfig {
        api_key: cfg.openai_api_key.clone().unwrap_or_default(),
        api_url: cfg.inference_url.clone(),
        model: cfg.inference_model.clone(),
        ..Default::default()
    }
}

// ── IPC Commands ────────────────────────────────────────────────────

#[tauri::command]
pub async fn execute_shell(
    app_state: State<'_, AppState>,
    command: String,
    shard_id: Option<String>,
) -> Result<String, String> {
    let data_dir = {
        let cfg = app_state.config.lock().map_err(|e| e.to_string())?;
        cfg.data_dir.clone()
    };

    let sid = shard_id.unwrap_or_else(|| "desktop".to_string());
    let tool_call = ToolCall {
        id: "desktop_shell".to_string(),
        name: "shell_exec".to_string(),
        arguments: serde_json::json!({ "command": command }),
    };
    let result = executor::execute_tool(&data_dir, &sid, &tool_call).await;
    if result.success {
        Ok(result.output)
    } else {
        Err(result.output)
    }
}

#[tauri::command]
pub async fn read_file(
    app_state: State<'_, AppState>,
    path: String,
    shard_id: Option<String>,
) -> Result<String, String> {
    let data_dir = {
        let cfg = app_state.config.lock().map_err(|e| e.to_string())?;
        cfg.data_dir.clone()
    };

    let sid = shard_id.unwrap_or_else(|| "desktop".to_string());
    let tool_call = ToolCall {
        id: "desktop_read".to_string(),
        name: "file_read".to_string(),
        arguments: serde_json::json!({ "path": path }),
    };
    let result = executor::execute_tool(&data_dir, &sid, &tool_call).await;
    if result.success {
        Ok(result.output)
    } else {
        Err(result.output)
    }
}

#[tauri::command]
pub async fn write_file(
    app_state: State<'_, AppState>,
    path: String,
    content: String,
    shard_id: Option<String>,
) -> Result<String, String> {
    let data_dir = {
        let cfg = app_state.config.lock().map_err(|e| e.to_string())?;
        cfg.data_dir.clone()
    };

    let sid = shard_id.unwrap_or_else(|| "desktop".to_string());
    let tool_call = ToolCall {
        id: "desktop_write".to_string(),
        name: "file_write".to_string(),
        arguments: serde_json::json!({ "path": path, "content": content }),
    };
    let result = executor::execute_tool(&data_dir, &sid, &tool_call).await;
    if result.success {
        Ok(result.output)
    } else {
        Err(result.output)
    }
}

#[tauri::command]
pub async fn llm_chat(
    app_state: State<'_, AppState>,
    message: String,
    system_prompt: Option<String>,
) -> Result<String, String> {
    let inf_cfg = {
        let cfg = app_state.config.lock().map_err(|e| e.to_string())?;
        inference_config_from(&cfg)
    };

    let sys = system_prompt.unwrap_or_else(|| {
        "You are a helpful AI assistant running inside the Siphon desktop app.".to_string()
    });
    let conversation = vec![ChatMessage::text("user", &message)];
    inference::generate_response(&inf_cfg, &sys, &conversation).await
}

#[tauri::command]
pub async fn agent_loop(
    app_state: State<'_, AppState>,
    message: String,
    shard_id: Option<String>,
) -> Result<AgentLoopResult, String> {
    let (inf_cfg, data_dir) = {
        let cfg = app_state.config.lock().map_err(|e| e.to_string())?;
        (inference_config_from(&cfg), cfg.data_dir.clone())
    };

    let sid = shard_id.unwrap_or_else(|| "desktop".to_string());
    let tools = inference::shard_tool_definitions();
    let loop_cfg = AgentLoopConfig::default();
    let system_prompt = "You are a Siphon shard agent. You can read/write files, execute shell commands, evaluate code, and fetch URLs. Complete the user's task step by step.";

    let result = agent_loop::run_agent_loop(
        &inf_cfg,
        system_prompt,
        &message,
        &tools,
        &loop_cfg,
        &data_dir,
        &sid,
    )
    .await;

    Ok(result)
}

#[tauri::command]
pub fn get_config(app_state: State<'_, AppState>) -> Result<Config, String> {
    let cfg = app_state.config.lock().map_err(|e| e.to_string())?;
    Ok(cfg.clone())
}

#[tauri::command]
pub fn save_config(
    app_state: State<'_, AppState>,
    config: Config,
) -> Result<(), String> {
    state::save_config(&config)?;
    let mut current = app_state.config.lock().map_err(|e| e.to_string())?;
    *current = config;
    Ok(())
}

// ── Shard types ─────────────────────────────────────────────────────

const SHARD_TYPE_NAMES: [&str; 8] = [
    "Oracle", "Cipher", "Scribe", "Muse", "Architect", "Advocate", "Sentinel", "Mirror",
];

/// Raw shard from the web API (camelCase, numeric `type` field).
#[derive(Debug, Deserialize)]
struct RawShard {
    id: String,
    name: String,
    #[serde(rename = "type")]
    shard_type: u8,
    level: u32,
    #[serde(default)]
    species: String,
}

/// Normalized shard info returned over IPC to the frontend.
#[derive(Debug, Serialize, Deserialize)]
pub struct ShardInfo {
    pub id: String,
    pub name: String,
    pub shard_type: String,
    pub level: u32,
    pub species: String,
}

impl From<RawShard> for ShardInfo {
    fn from(raw: RawShard) -> Self {
        let type_name = SHARD_TYPE_NAMES
            .get(raw.shard_type as usize)
            .unwrap_or(&"Unknown");
        Self {
            id: raw.id,
            name: raw.name,
            shard_type: type_name.to_string(),
            level: raw.level,
            species: raw.species,
        }
    }
}

#[tauri::command]
pub async fn list_shards(
    api_base_url: Option<String>,
    owner_id: Option<String>,
) -> Result<Vec<ShardInfo>, String> {
    let base = api_base_url.unwrap_or_else(|| "http://localhost:3001".to_string());
    let url = match &owner_id {
        Some(id) => format!("{}/api/shards?ownerId={}", base, id),
        None => format!("{}/api/shards", base),
    };
    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to fetch shards: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("API error: {}", resp.status()));
    }
    let raw_shards: Vec<RawShard> = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse shards: {}", e))?;
    Ok(raw_shards.into_iter().map(ShardInfo::from).collect())
}

// ── User tier ───────────────────────────────────────────────────────

/// Raw subscription response from GET /api/subscriptions?userId=...
#[derive(Debug, Deserialize)]
struct RawSubscription {
    tier: String,
    #[serde(rename = "shardLimit")]
    shard_limit: u32,
}

/// Normalized tier info returned over IPC.
#[derive(Debug, Serialize, Deserialize)]
pub struct UserTier {
    pub tier: String,
    pub shard_limit: u32,
}

#[tauri::command]
pub async fn get_user_tier(
    api_base_url: Option<String>,
    user_id: Option<String>,
) -> Result<UserTier, String> {
    let base = api_base_url.unwrap_or_else(|| "http://localhost:3000".to_string());
    let uid = match user_id {
        Some(id) => id,
        None => {
            return Ok(UserTier {
                tier: "free_trainer".to_string(),
                shard_limit: 0,
            });
        }
    };
    let url = format!("{}/api/subscriptions?userId={}", base, uid);
    let resp = reqwest::get(&url).await;
    match resp {
        Ok(r) if r.status().is_success() => {
            let raw: RawSubscription = r
                .json()
                .await
                .map_err(|e| format!("Failed to parse tier: {}", e))?;
            Ok(UserTier {
                tier: raw.tier,
                shard_limit: raw.shard_limit,
            })
        }
        _ => Ok(UserTier {
            tier: "free_trainer".to_string(),
            shard_limit: 0,
        }),
    }
}

// ── Job templates ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub prompt_template: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobRunResult {
    pub template_id: String,
    pub template_name: String,
    pub rendered_prompt: String,
    pub final_response: Option<String>,
    pub stop_reason: agent_loop::StopReason,
    pub total_tool_calls: usize,
    pub artifact_path: String,
}

fn built_in_job_templates() -> Vec<JobTemplate> {
    vec![
        JobTemplate {
            id: "bug-triage".to_string(),
            name: "Bug Triage".to_string(),
            description: "Analyze a bug report and produce root-cause hypotheses plus next steps.".to_string(),
            prompt_template: "Analyze this bug report and return: (1) likely root causes, (2) validation steps, (3) fix plan.\n\nBug report:\n{{input}}".to_string(),
        },
        JobTemplate {
            id: "test-generator".to_string(),
            name: "Test Generator".to_string(),
            description: "Generate practical unit/integration test cases for a module.".to_string(),
            prompt_template: "Generate high-value test cases for this module. Include edge cases and failure modes.\n\nModule/context:\n{{input}}".to_string(),
        },
        JobTemplate {
            id: "docs-synth".to_string(),
            name: "Docs Synthesizer".to_string(),
            description: "Convert notes into clean docs with action items.".to_string(),
            prompt_template: "Turn these raw notes into concise documentation with headings, decisions, and action items.\n\nNotes:\n{{input}}".to_string(),
        },
        JobTemplate {
            id: "research-brief".to_string(),
            name: "Research Brief".to_string(),
            description: "Create a decision-ready brief from a question.".to_string(),
            prompt_template: "Prepare a decision brief: summary, options, tradeoffs, recommendation, and open questions.\n\nResearch question:\n{{input}}".to_string(),
        },
    ]
}

#[tauri::command]
pub fn list_job_templates() -> Vec<JobTemplate> {
    built_in_job_templates()
}

#[tauri::command]
pub async fn run_job_template(
    app_state: State<'_, AppState>,
    template_id: String,
    input: String,
    shard_id: Option<String>,
) -> Result<JobRunResult, String> {
    let template = built_in_job_templates()
        .into_iter()
        .find(|t| t.id == template_id)
        .ok_or_else(|| format!("Unknown template: {}", template_id))?;

    let rendered_prompt = template.prompt_template.replace("{{input}}", input.trim());

    let (inf_cfg, data_dir) = {
        let cfg = app_state.config.lock().map_err(|e| e.to_string())?;
        (inference_config_from(&cfg), cfg.data_dir.clone())
    };
    let sid = shard_id.unwrap_or_else(|| "desktop".to_string());
    let tools = inference::shard_tool_definitions();
    let loop_cfg = AgentLoopConfig::default();
    let system_prompt = "You are a Siphon shard worker. Complete the job template task and produce practical, concrete output.";

    let loop_result = agent_loop::run_agent_loop(
        &inf_cfg,
        system_prompt,
        &rendered_prompt,
        &tools,
        &loop_cfg,
        &data_dir,
        &sid,
    )
    .await;

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let artifact_dir = Path::new(&data_dir).join("artifacts").join(&sid);
    std::fs::create_dir_all(&artifact_dir).map_err(|e| e.to_string())?;
    let artifact_path = artifact_dir.join(format!("{}-{}.md", template.id, ts));
    let artifact_contents = format!(
        "# {}\n\n## Prompt\n{}\n\n## Output\n{}\n\n## Meta\n- stop_reason: {:?}\n- tool_calls: {}\n",
        template.name,
        rendered_prompt,
        loop_result
            .final_response
            .clone()
            .unwrap_or_else(|| "No final response generated.".to_string()),
        loop_result.stop_reason,
        loop_result.total_tool_calls
    );
    std::fs::write(&artifact_path, artifact_contents).map_err(|e| e.to_string())?;

    Ok(JobRunResult {
        template_id: template.id,
        template_name: template.name,
        rendered_prompt,
        final_response: loop_result.final_response,
        stop_reason: loop_result.stop_reason,
        total_tool_calls: loop_result.total_tool_calls,
        artifact_path: artifact_path.to_string_lossy().to_string(),
    })
}
