use serde::{Deserialize, Serialize};
use std::time::Instant;

use crate::executor;
use crate::inference::{self, ChatMessage, InferenceConfig, InferenceResult, ToolDefinition};

// ── Types ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct AgentLoopConfig {
    pub max_turns: u32,
    pub turn_timeout_secs: u64,
}

impl Default for AgentLoopConfig {
    fn default() -> Self {
        Self {
            max_turns: 5,
            turn_timeout_secs: 60,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Turn {
    pub turn_number: u32,
    pub inference_result: InferenceResult,
    pub tool_results: Vec<executor::ToolResult>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum StopReason {
    Completed,
    MaxTurns,
    TurnTimeout,
    InferenceError,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentLoopResult {
    pub turns: Vec<Turn>,
    pub final_response: Option<String>,
    pub total_tool_calls: usize,
    pub all_tool_results: Vec<executor::ToolResult>,
    pub all_success: bool,
    pub stop_reason: StopReason,
}

// ── Core loop ────────────────────────────────────────────────────────

/// Run a multi-turn agent loop: inference → tool calls → feed results → repeat.
pub async fn run_agent_loop(
    inference_config: &InferenceConfig,
    system_prompt: &str,
    initial_message: &str,
    tools: &[ToolDefinition],
    loop_config: &AgentLoopConfig,
    data_dir: &str,
    shard_id: &str,
) -> AgentLoopResult {
    let mut conversation = vec![ChatMessage::text("user", initial_message)];
    let mut turns = Vec::new();
    let mut all_tool_results = Vec::new();
    let mut all_success = true;
    let mut final_response = None;
    let mut stop_reason = StopReason::MaxTurns;

    for turn_number in 1..=loop_config.max_turns {
        let turn_start = Instant::now();

        // Apply per-turn timeout
        let inference_future =
            inference::generate_with_tools(inference_config, system_prompt, &conversation, tools);

        let result = tokio::time::timeout(
            std::time::Duration::from_secs(loop_config.turn_timeout_secs),
            inference_future,
        )
        .await;

        let inference_result = match result {
            Ok(Ok(r)) => r,
            Ok(Err(e)) => {
                tracing::warn!("Agent loop inference error on turn {}: {}", turn_number, e);
                stop_reason = StopReason::InferenceError;
                break;
            }
            Err(_) => {
                tracing::warn!("Agent loop turn {} timed out", turn_number);
                stop_reason = StopReason::TurnTimeout;
                break;
            }
        };

        let duration_ms = turn_start.elapsed().as_millis() as u64;

        match inference_result {
            InferenceResult::Text { ref content } => {
                final_response = Some(content.clone());
                turns.push(Turn {
                    turn_number,
                    inference_result,
                    tool_results: vec![],
                    duration_ms,
                });
                stop_reason = StopReason::Completed;
                break;
            }
            InferenceResult::ToolCalls { ref calls } => {
                // Append assistant message with tool calls to conversation
                conversation.push(ChatMessage::assistant_tool_calls(calls));

                // Execute each tool and append results
                let mut turn_results = Vec::new();
                for call in calls {
                    let result = executor::execute_tool(data_dir, shard_id, call).await;
                    conversation.push(ChatMessage::tool_result(
                        &call.id,
                        &call.name,
                        &result.output,
                    ));
                    if !result.success {
                        all_success = false;
                    }
                    turn_results.push(result);
                }

                all_tool_results.extend(turn_results.clone());

                turns.push(Turn {
                    turn_number,
                    inference_result,
                    tool_results: turn_results,
                    duration_ms,
                });
            }
        }
    }

    AgentLoopResult {
        turns,
        final_response,
        total_tool_calls: all_tool_results.len(),
        all_tool_results,
        all_success,
        stop_reason,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn agent_loop_config_defaults() {
        let cfg = AgentLoopConfig::default();
        assert_eq!(cfg.max_turns, 5);
        assert_eq!(cfg.turn_timeout_secs, 60);
    }

    #[test]
    fn stop_reason_serialization() {
        let sr = StopReason::Completed;
        let json = serde_json::to_string(&sr).unwrap();
        assert_eq!(json, "\"Completed\"");

        let sr2: StopReason = serde_json::from_str("\"MaxTurns\"").unwrap();
        assert_eq!(sr2, StopReason::MaxTurns);
    }

    #[test]
    fn turn_serializes() {
        let turn = Turn {
            turn_number: 1,
            inference_result: InferenceResult::Text {
                content: "done".to_string(),
            },
            tool_results: vec![],
            duration_ms: 42,
        };
        let json = serde_json::to_string(&turn).unwrap();
        assert!(json.contains("\"turn_number\":1"));
        assert!(json.contains("\"duration_ms\":42"));
    }

    #[test]
    fn agent_loop_result_empty() {
        let result = AgentLoopResult {
            turns: vec![],
            final_response: None,
            total_tool_calls: 0,
            all_tool_results: vec![],
            all_success: true,
            stop_reason: StopReason::MaxTurns,
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"stop_reason\":\"MaxTurns\""));
        assert!(json.contains("\"total_tool_calls\":0"));
    }
}
