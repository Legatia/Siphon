use reqwest::Client;
use serde::{Deserialize, Serialize};

// ── Basic chat types ────────────────────────────────────────────────

/// Request body for the OpenAI-compatible Chat Completions API.
#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    temperature: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<ToolDefinition>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCallRef>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

/// Compact tool call representation for the OpenAI message format.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCallRef {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: ToolCallFunction,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCallFunction {
    pub name: String,
    pub arguments: String, // JSON string
}

impl ChatMessage {
    /// Create a text message (system, user, or assistant).
    pub fn text(role: &str, content: &str) -> Self {
        Self {
            role: role.to_string(),
            content: Some(content.to_string()),
            tool_calls: None,
            tool_call_id: None,
            name: None,
        }
    }

    /// Create a tool result message.
    pub fn tool_result(tool_call_id: &str, name: &str, content: &str) -> Self {
        Self {
            role: "tool".to_string(),
            content: Some(content.to_string()),
            tool_calls: None,
            tool_call_id: Some(tool_call_id.to_string()),
            name: Some(name.to_string()),
        }
    }

    /// Create an assistant message with tool calls (content may be None).
    pub fn assistant_tool_calls(calls: &[ToolCall]) -> Self {
        let refs = calls
            .iter()
            .map(|c| ToolCallRef {
                id: c.id.clone(),
                call_type: "function".to_string(),
                function: ToolCallFunction {
                    name: c.name.clone(),
                    arguments: serde_json::to_string(&c.arguments).unwrap_or_default(),
                },
            })
            .collect();
        Self {
            role: "assistant".to_string(),
            content: None,
            tool_calls: Some(refs),
            tool_call_id: None,
            name: None,
        }
    }
}

/// Response body from the OpenAI-compatible Chat Completions API.
#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatResponseMessage,
    #[serde(default)]
    finish_reason: Option<String>,
}

/// Response message — can contain either content or tool_calls (or both).
#[derive(Debug, Deserialize)]
struct ChatResponseMessage {
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    tool_calls: Option<Vec<RawToolCall>>,
}

#[derive(Debug, Deserialize)]
struct RawToolCall {
    id: String,
    function: RawFunctionCall,
}

#[derive(Debug, Deserialize)]
struct RawFunctionCall {
    name: String,
    arguments: String, // JSON string
}

#[derive(Debug, Serialize)]
struct EmbeddingRequest {
    model: String,
    input: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct EmbeddingResponse {
    data: Vec<EmbeddingData>,
}

#[derive(Debug, Deserialize)]
struct EmbeddingData {
    embedding: Vec<f32>,
}

// ── Tool definitions (OpenAI function calling) ──────────────────────

/// A tool definition sent in the request to enable function calling.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    #[serde(rename = "type")]
    pub tool_type: String, // always "function"
    pub function: FunctionDefinition,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionDefinition {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value, // JSON Schema object
}

/// A parsed tool call returned from the LLM.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: serde_json::Value, // parsed JSON
}

/// The result of a tool-calling inference — either plain text or tool calls.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum InferenceResult {
    Text { content: String },
    ToolCalls { calls: Vec<ToolCall> },
}

impl ToolDefinition {
    pub fn new(name: &str, description: &str, parameters: serde_json::Value) -> Self {
        Self {
            tool_type: "function".to_string(),
            function: FunctionDefinition {
                name: name.to_string(),
                description: description.to_string(),
                parameters,
            },
        }
    }
}

// ── Config ──────────────────────────────────────────────────────────

/// Configuration for inference requests.
pub struct InferenceConfig {
    pub api_key: String,
    pub api_url: String,
    pub model: String,
    pub max_tokens: u32,
    pub temperature: f64,
}

impl Default for InferenceConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            api_url: "https://api.openai.com/v1/chat/completions".to_string(),
            model: "gpt-4o-mini".to_string(),
            max_tokens: 512,
            temperature: 0.7,
        }
    }
}

// ── Core request helper ─────────────────────────────────────────────

/// Send a chat completion request and return the raw response.
async fn send_completion(
    config: &InferenceConfig,
    messages: Vec<ChatMessage>,
    tools: Option<Vec<ToolDefinition>>,
) -> Result<ChatCompletionResponse, String> {
    let request_body = ChatCompletionRequest {
        model: config.model.clone(),
        messages,
        max_tokens: config.max_tokens,
        temperature: config.temperature,
        tools,
    };

    let client = Client::new();
    let mut request = client
        .post(&config.api_url)
        .header("Content-Type", "application/json");

    if !config.api_key.is_empty() {
        request = request.header("Authorization", format!("Bearer {}", config.api_key));
    }

    let response = request
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "unable to read body".to_string());
        return Err(format!("Inference API error ({}): {}", status, body));
    }

    response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))
}

// ── Public API: plain text ──────────────────────────────────────────

/// Generate a plain text response from the LLM.
pub async fn generate_response(
    config: &InferenceConfig,
    system_prompt: &str,
    conversation: &[ChatMessage],
) -> Result<String, String> {
    let mut messages = vec![ChatMessage::text("system", system_prompt)];
    messages.extend_from_slice(conversation);

    let completion = send_completion(config, messages, None).await?;

    completion
        .choices
        .first()
        .and_then(|c| c.message.content.clone())
        .ok_or_else(|| "No response choices returned".to_string())
}

/// Generate a response for a shard interaction, using the shard's personality.
pub async fn generate_shard_response(
    api_key: &str,
    api_url: &str,
    model: &str,
    personality: &str,
    user_message: &str,
    history: &[ChatMessage],
) -> Result<String, String> {
    let config = InferenceConfig {
        api_key: api_key.to_string(),
        api_url: api_url.to_string(),
        model: model.to_string(),
        ..Default::default()
    };

    let mut conversation = history.to_vec();
    conversation.push(ChatMessage::text("user", user_message));

    generate_response(&config, personality, &conversation).await
}

// ── Public API: tool calling ────────────────────────────────────────

/// Generate a response that may include tool calls.
/// Returns InferenceResult::Text if the model responds with text,
/// or InferenceResult::ToolCalls if the model wants to invoke tools.
pub async fn generate_with_tools(
    config: &InferenceConfig,
    system_prompt: &str,
    conversation: &[ChatMessage],
    tools: &[ToolDefinition],
) -> Result<InferenceResult, String> {
    let mut messages = vec![ChatMessage::text("system", system_prompt)];
    messages.extend_from_slice(conversation);

    let tool_defs = if tools.is_empty() {
        None
    } else {
        Some(tools.to_vec())
    };

    let completion = send_completion(config, messages, tool_defs).await?;

    let choice = completion
        .choices
        .first()
        .ok_or("No response choices returned")?;

    // Check if the model returned tool calls
    if let Some(raw_calls) = &choice.message.tool_calls {
        if !raw_calls.is_empty() {
            let calls = raw_calls
                .iter()
                .map(|rc| {
                    let arguments: serde_json::Value =
                        serde_json::from_str(&rc.function.arguments).unwrap_or_default();
                    ToolCall {
                        id: rc.id.clone(),
                        name: rc.function.name.clone(),
                        arguments,
                    }
                })
                .collect();
            return Ok(InferenceResult::ToolCalls { calls });
        }
    }

    // Otherwise return text
    let content = choice
        .message
        .content
        .clone()
        .unwrap_or_default();
    Ok(InferenceResult::Text { content })
}

/// Generate embeddings for a batch of texts. Returns vectors in input order.
pub async fn embed_texts(
    config: &InferenceConfig,
    inputs: &[String],
) -> Result<Vec<Vec<f32>>, String> {
    if inputs.is_empty() {
        return Ok(vec![]);
    }

    let endpoint = embedding_url_from_chat_url(&config.api_url);
    let model = embedding_model_for(&config.model);
    let request_body = EmbeddingRequest {
        model,
        input: inputs.to_vec(),
    };

    let client = Client::new();
    let mut request = client
        .post(&endpoint)
        .header("Content-Type", "application/json");

    if !config.api_key.is_empty() {
        request = request.header("Authorization", format!("Bearer {}", config.api_key));
    }

    let response = request
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Embedding HTTP request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "unable to read body".to_string());
        return Err(format!("Embedding API error ({}): {}", status, body));
    }

    let parsed: EmbeddingResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse embedding response: {}", e))?;

    let vectors = parsed
        .data
        .into_iter()
        .map(|d| d.embedding)
        .collect::<Vec<_>>();

    if vectors.len() != inputs.len() {
        return Err(format!(
            "Embedding cardinality mismatch: got {}, expected {}",
            vectors.len(),
            inputs.len()
        ));
    }

    Ok(vectors)
}

fn embedding_url_from_chat_url(api_url: &str) -> String {
    if api_url.contains("/chat/completions") {
        return api_url.replace("/chat/completions", "/embeddings");
    }
    format!("{}/embeddings", api_url.trim_end_matches('/'))
}

fn embedding_model_for(chat_model: &str) -> String {
    // OpenAI chat models are not embedding models.
    if chat_model.starts_with("gpt-") {
        "text-embedding-3-small".to_string()
    } else {
        chat_model.to_string()
    }
}

// ── Built-in tool definitions for shard execution ───────────────────

/// Returns the set of tool definitions available to shards during task execution.
pub fn shard_tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition::new(
            "code_eval",
            "Evaluate a code snippet and return the output. Supports Python and JavaScript.",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "language": {
                        "type": "string",
                        "enum": ["python", "javascript"],
                        "description": "Programming language to evaluate"
                    },
                    "code": {
                        "type": "string",
                        "description": "The code to evaluate"
                    }
                },
                "required": ["language", "code"]
            }),
        ),
        ToolDefinition::new(
            "http_fetch",
            "Fetch content from a URL via HTTP GET. Returns the response body as text.",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The URL to fetch"
                    }
                },
                "required": ["url"]
            }),
        ),
        ToolDefinition::new(
            "file_read",
            "Read the contents of a file from the shard's workspace.",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path within the shard workspace"
                    }
                },
                "required": ["path"]
            }),
        ),
        ToolDefinition::new(
            "file_write",
            "Write content to a file in the shard's workspace.",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path within the shard workspace"
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to write"
                    }
                },
                "required": ["path", "content"]
            }),
        ),
        ToolDefinition::new(
            "shell_exec",
            "Execute a shell command in a sandboxed environment. Returns stdout and stderr.",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The shell command to execute"
                    },
                    "timeout_secs": {
                        "type": "integer",
                        "description": "Timeout in seconds (default 30, max 120)",
                        "default": 30
                    }
                },
                "required": ["command"]
            }),
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inference_config_defaults() {
        let cfg = InferenceConfig::default();
        assert!(cfg.api_key.is_empty());
        assert_eq!(cfg.api_url, "https://api.openai.com/v1/chat/completions");
        assert_eq!(cfg.model, "gpt-4o-mini");
        assert_eq!(cfg.max_tokens, 512);
        assert!((cfg.temperature - 0.7).abs() < f64::EPSILON);
    }

    #[test]
    fn ollama_config_has_empty_key() {
        let cfg = InferenceConfig {
            api_key: String::new(),
            api_url: "http://localhost:11434/v1/chat/completions".to_string(),
            model: "llama3.2".to_string(),
            ..Default::default()
        };
        assert!(cfg.api_key.is_empty());
        assert!(cfg.api_url.contains("11434"));
    }

    #[test]
    fn chat_message_serialization() {
        let msg = ChatMessage::text("user", "Hello");
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"role\":\"user\""));
        assert!(json.contains("\"content\":\"Hello\""));
        // Optional None fields should be omitted
        assert!(!json.contains("tool_calls"));
        assert!(!json.contains("tool_call_id"));

        let back: ChatMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(back.role, "user");
        assert_eq!(back.content.unwrap(), "Hello");
    }

    #[test]
    fn chat_message_tool_result() {
        let msg = ChatMessage::tool_result("call_1", "code_eval", "42");
        assert_eq!(msg.role, "tool");
        assert_eq!(msg.tool_call_id.unwrap(), "call_1");
        assert_eq!(msg.name.unwrap(), "code_eval");
        assert_eq!(msg.content.unwrap(), "42");
    }

    #[test]
    fn chat_message_assistant_tool_calls() {
        let calls = vec![ToolCall {
            id: "call_1".to_string(),
            name: "http_fetch".to_string(),
            arguments: serde_json::json!({"url": "https://example.com"}),
        }];
        let msg = ChatMessage::assistant_tool_calls(&calls);
        assert_eq!(msg.role, "assistant");
        assert!(msg.content.is_none());
        let refs = msg.tool_calls.unwrap();
        assert_eq!(refs.len(), 1);
        assert_eq!(refs[0].id, "call_1");
        assert_eq!(refs[0].function.name, "http_fetch");
    }

    #[test]
    fn tool_definition_serializes_correctly() {
        let tool = ToolDefinition::new(
            "test_tool",
            "A test tool",
            serde_json::json!({"type": "object", "properties": {}}),
        );
        let json = serde_json::to_string(&tool).unwrap();
        assert!(json.contains("\"type\":\"function\""));
        assert!(json.contains("\"name\":\"test_tool\""));
        assert!(json.contains("\"description\":\"A test tool\""));
    }

    #[test]
    fn shard_tools_are_defined() {
        let tools = shard_tool_definitions();
        assert_eq!(tools.len(), 5);

        let names: Vec<&str> = tools.iter().map(|t| t.function.name.as_str()).collect();
        assert!(names.contains(&"code_eval"));
        assert!(names.contains(&"http_fetch"));
        assert!(names.contains(&"file_read"));
        assert!(names.contains(&"file_write"));
        assert!(names.contains(&"shell_exec"));
    }

    #[test]
    fn tool_call_round_trip() {
        let tc = ToolCall {
            id: "call_abc".to_string(),
            name: "code_eval".to_string(),
            arguments: serde_json::json!({"language": "python", "code": "print(42)"}),
        };
        let json = serde_json::to_string(&tc).unwrap();
        let back: ToolCall = serde_json::from_str(&json).unwrap();
        assert_eq!(back.id, "call_abc");
        assert_eq!(back.name, "code_eval");
        assert_eq!(back.arguments["language"], "python");
    }

    #[test]
    fn inference_result_text_variant() {
        let result = InferenceResult::Text {
            content: "Hello".to_string(),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"type\":\"Text\""));
        assert!(json.contains("\"content\":\"Hello\""));
    }

    #[test]
    fn inference_result_tool_calls_variant() {
        let result = InferenceResult::ToolCalls {
            calls: vec![ToolCall {
                id: "call_1".to_string(),
                name: "http_fetch".to_string(),
                arguments: serde_json::json!({"url": "https://example.com"}),
            }],
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"type\":\"ToolCalls\""));
        assert!(json.contains("\"name\":\"http_fetch\""));
    }

    #[test]
    fn embedding_url_mapping() {
        assert_eq!(
            embedding_url_from_chat_url("https://api.openai.com/v1/chat/completions"),
            "https://api.openai.com/v1/embeddings"
        );
        assert_eq!(
            embedding_url_from_chat_url("http://localhost:11434/v1/chat/completions"),
            "http://localhost:11434/v1/embeddings"
        );
    }

    #[test]
    fn embedding_model_mapping() {
        assert_eq!(embedding_model_for("gpt-4o-mini"), "text-embedding-3-small");
        assert_eq!(embedding_model_for("nomic-embed-text"), "nomic-embed-text");
    }
}
