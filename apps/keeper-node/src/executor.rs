use crate::inference::ToolCall;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::process::Command;

/// Result of executing a single tool call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub tool_call_id: String,
    pub tool_name: String,
    pub success: bool,
    pub output: String,
}

/// Execute a tool call within a shard's workspace.
/// The workspace is an isolated directory under the keeper's data dir.
pub async fn execute_tool(
    data_dir: &str,
    shard_id: &str,
    call: &ToolCall,
) -> ToolResult {
    let workspace = shard_workspace(data_dir, shard_id);
    std::fs::create_dir_all(&workspace).ok();

    let result = match call.name.as_str() {
        "code_eval" => execute_code_eval(&call.arguments, &workspace).await,
        "http_fetch" => execute_http_fetch(&call.arguments).await,
        "file_read" => execute_file_read(&call.arguments, &workspace),
        "file_write" => execute_file_write(&call.arguments, &workspace),
        "shell_exec" => execute_shell(&call.arguments, &workspace).await,
        other => Err(format!("Unknown tool: {}", other)),
    };

    match result {
        Ok(output) => ToolResult {
            tool_call_id: call.id.clone(),
            tool_name: call.name.clone(),
            success: true,
            output,
        },
        Err(err) => ToolResult {
            tool_call_id: call.id.clone(),
            tool_name: call.name.clone(),
            success: false,
            output: err,
        },
    }
}

fn shard_workspace(data_dir: &str, shard_id: &str) -> PathBuf {
    let expanded = shellexpand(data_dir);
    Path::new(&expanded).join("workspaces").join(shard_id)
}

// ── Tool implementations ────────────────────────────────────────────

async fn execute_code_eval(
    args: &serde_json::Value,
    workspace: &Path,
) -> Result<String, String> {
    let language = args["language"]
        .as_str()
        .ok_or("Missing 'language' argument")?;
    let code = args["code"]
        .as_str()
        .ok_or("Missing 'code' argument")?;

    let (cmd, ext) = match language {
        "python" => ("python3", "py"),
        "javascript" => ("node", "js"),
        _ => return Err(format!("Unsupported language: {}", language)),
    };

    let script_path = workspace.join(format!("_eval.{}", ext));
    std::fs::write(&script_path, code)
        .map_err(|e| format!("Failed to write script: {}", e))?;

    let output = Command::new(cmd)
        .arg(&script_path)
        .current_dir(workspace)
        .output()
        .await
        .map_err(|e| format!("Failed to execute {}: {}", cmd, e))?;

    // Clean up
    std::fs::remove_file(&script_path).ok();

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if output.status.success() {
        Ok(stdout.to_string())
    } else {
        Err(format!("Exit code {}\nstdout: {}\nstderr: {}",
            output.status.code().unwrap_or(-1), stdout, stderr))
    }
}

async fn execute_http_fetch(args: &serde_json::Value) -> Result<String, String> {
    let url = args["url"]
        .as_str()
        .ok_or("Missing 'url' argument")?;

    // Basic URL validation
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("URL must start with http:// or https://".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Truncate very large responses
    let truncated = if body.len() > 50_000 {
        format!("{}...\n[truncated at 50KB]", &body[..50_000])
    } else {
        body
    };

    if status.is_success() {
        Ok(truncated)
    } else {
        Err(format!("HTTP {} — {}", status, truncated))
    }
}

/// Check that a relative path doesn't escape the workspace via `..` components.
fn is_safe_path(path: &str) -> bool {
    !path.contains("..") && !path.starts_with('/')
}

fn execute_file_read(
    args: &serde_json::Value,
    workspace: &Path,
) -> Result<String, String> {
    let path = args["path"]
        .as_str()
        .ok_or("Missing 'path' argument")?;

    if !is_safe_path(path) {
        return Err("Path traversal not allowed".to_string());
    }

    let resolved = workspace.join(path);
    std::fs::read_to_string(&resolved)
        .map_err(|e| format!("Failed to read file: {}", e))
}

fn execute_file_write(
    args: &serde_json::Value,
    workspace: &Path,
) -> Result<String, String> {
    let path = args["path"]
        .as_str()
        .ok_or("Missing 'path' argument")?;
    let content = args["content"]
        .as_str()
        .ok_or("Missing 'content' argument")?;

    if !is_safe_path(path) {
        return Err("Path traversal not allowed".to_string());
    }

    let resolved = workspace.join(path);

    // Create parent dirs if needed
    if let Some(parent) = resolved.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    std::fs::write(&resolved, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(format!("Wrote {} bytes to {}", content.len(), path))
}

async fn execute_shell(
    args: &serde_json::Value,
    workspace: &Path,
) -> Result<String, String> {
    let command = args["command"]
        .as_str()
        .ok_or("Missing 'command' argument")?;

    let mut parts = command.split_whitespace();
    let program = parts.next().ok_or("Command cannot be empty")?;
    let argv: Vec<&str> = parts.collect();

    let timeout_secs = args["timeout_secs"]
        .as_u64()
        .unwrap_or(30)
        .min(120);

    let output = tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs),
        Command::new(program)
            .args(&argv)
            .current_dir(workspace)
            .output(),
    )
    .await
    .map_err(|_| format!("Command timed out after {}s", timeout_secs))?
    .map_err(|e| format!("Failed to execute command: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    let combined = if stderr.is_empty() {
        stdout.to_string()
    } else {
        format!("{}\n[stderr]\n{}", stdout, stderr)
    };

    if output.status.success() {
        Ok(combined)
    } else {
        Err(format!("Exit code {}\n{}", output.status.code().unwrap_or(-1), combined))
    }
}

fn shellexpand(path: &str) -> String {
    if path.starts_with("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return format!("{}{}", home, &path[1..]);
        }
    }
    path.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shard_workspace_path() {
        let ws = shard_workspace("/tmp/siphon", "abc-123");
        assert!(ws.to_string_lossy().contains("workspaces"));
        assert!(ws.to_string_lossy().contains("abc-123"));
    }

    #[test]
    fn file_read_blocks_traversal() {
        let workspace = Path::new("/tmp/test-workspace");

        let args = serde_json::json!({"path": "../../etc/passwd"});
        let result = execute_file_read(&args, workspace);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("traversal"));

        // Absolute path also blocked
        let args2 = serde_json::json!({"path": "/etc/passwd"});
        let result2 = execute_file_read(&args2, workspace);
        assert!(result2.is_err());
    }

    #[test]
    fn file_write_blocks_traversal() {
        let workspace = Path::new("/tmp/test-workspace");
        let args = serde_json::json!({"path": "../../etc/evil", "content": "bad"});
        let result = execute_file_write(&args, workspace);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("traversal"));
    }

    #[tokio::test]
    async fn file_read_write_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path();

        let write_args = serde_json::json!({"path": "test.txt", "content": "hello shard"});
        let write_result = execute_file_write(&write_args, workspace);
        assert!(write_result.is_ok());

        let read_args = serde_json::json!({"path": "test.txt"});
        let read_result = execute_file_read(&read_args, workspace);
        assert_eq!(read_result.unwrap(), "hello shard");
    }

    #[tokio::test]
    async fn http_fetch_rejects_bad_scheme() {
        let args = serde_json::json!({"url": "ftp://example.com"});
        let result = execute_http_fetch(&args).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("http"));
    }

    #[tokio::test]
    async fn shell_exec_basic() {
        let dir = tempfile::tempdir().unwrap();
        let args = serde_json::json!({"command": "echo hello"});
        let result = execute_shell(&args, dir.path()).await;
        assert!(result.is_ok());
        assert!(result.unwrap().contains("hello"));
    }

    #[tokio::test]
    async fn code_eval_missing_language() {
        let dir = tempfile::tempdir().unwrap();
        let args = serde_json::json!({"code": "print(1)"});
        let result = execute_code_eval(&args, dir.path()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("language"));
    }
}
