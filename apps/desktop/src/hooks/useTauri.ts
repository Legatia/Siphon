import { invoke } from "@tauri-apps/api/core";

// ── Config types ────────────────────────────────────────────────────

export interface KeeperConfig {
  rpc_url: string;
  private_key_path: string;
  data_dir: string;
  listen_port: number;
  bootstrap_peers: string[];
  openai_api_key: string | null;
  api_key: string | null;
  shard_registry_address: string | null;
  keeper_staking_address: string | null;
  shard_valuation_address: string | null;
  loan_vault_address: string | null;
  inference_provider: string;
  inference_url: string;
  inference_model: string;
  http_port: number;
}

export interface ShardInfo {
  id: string;
  name: string;
  shard_type: string;
  level: number;
  species: string;
}

export interface UserTier {
  tier: string;
  shard_limit: number;
}

export interface ToolResult {
  tool_call_id: string;
  tool_name: string;
  success: boolean;
  output: string;
}

export interface AgentLoopResult {
  turns: unknown[];
  final_response: string | null;
  total_tool_calls: number;
  all_tool_results: ToolResult[];
  all_success: boolean;
  stop_reason: string;
}

// ── IPC wrappers (keys must be snake_case to match Rust params) ─────

export async function executeShell(
  command: string,
  shardId?: string
): Promise<string> {
  return invoke("execute_shell", { command, shard_id: shardId });
}

export async function readFile(
  path: string,
  shardId?: string
): Promise<string> {
  return invoke("read_file", { path, shard_id: shardId });
}

export async function writeFile(
  path: string,
  content: string,
  shardId?: string
): Promise<string> {
  return invoke("write_file", { path, content, shard_id: shardId });
}

export async function llmChat(
  message: string,
  systemPrompt?: string
): Promise<string> {
  return invoke("llm_chat", { message, system_prompt: systemPrompt });
}

export async function runAgentLoop(
  message: string,
  shardId?: string
): Promise<AgentLoopResult> {
  return invoke("agent_loop", { message, shard_id: shardId });
}

export async function getConfig(): Promise<KeeperConfig> {
  return invoke("get_config");
}

export async function saveConfig(config: KeeperConfig): Promise<void> {
  return invoke("save_config", { config });
}

export async function listShards(
  apiBaseUrl?: string,
  ownerId?: string
): Promise<ShardInfo[]> {
  return invoke("list_shards", { api_base_url: apiBaseUrl, owner_id: ownerId });
}

export async function getUserTier(
  apiBaseUrl?: string,
  userId?: string
): Promise<UserTier> {
  return invoke("get_user_tier", {
    api_base_url: apiBaseUrl,
    user_id: userId,
  });
}
