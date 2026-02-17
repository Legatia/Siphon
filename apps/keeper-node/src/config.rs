use serde::Deserialize;
use std::fs;
use std::path::PathBuf;

/// Keeper node configuration, loaded from ~/.siphon/config.toml
#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    /// JSON-RPC URL for Base Sepolia
    pub rpc_url: String,

    /// Path to the file containing the keeper's private key
    pub private_key_path: String,

    /// Directory for local data (SQLite DB, logs, etc.)
    pub data_dir: String,

    /// Port to listen for P2P connections
    pub listen_port: u16,

    /// Multiaddrs of bootstrap peers
    #[serde(default)]
    pub bootstrap_peers: Vec<String>,

    /// OpenAI API key for shard inference
    #[serde(default)]
    pub openai_api_key: Option<String>,

    /// Contract address for the ShardRegistry
    #[serde(default)]
    pub shard_registry_address: Option<String>,

    /// Contract address for the KeeperStaking contract
    #[serde(default)]
    pub keeper_staking_address: Option<String>,

    /// Contract address for the ShardValuation contract
    #[serde(default)]
    pub shard_valuation_address: Option<String>,

    /// Contract address for the LoanVault contract
    #[serde(default)]
    pub loan_vault_address: Option<String>,

    /// Inference provider: "openai", "ollama", or any OpenAI-compatible service
    #[serde(default = "default_inference_provider")]
    pub inference_provider: String,

    /// Base URL for the inference API
    #[serde(default = "default_inference_url")]
    pub inference_url: String,

    /// Model name for inference
    #[serde(default = "default_inference_model")]
    pub inference_model: String,

    /// Port for the HTTP API server
    #[serde(default = "default_http_port")]
    pub http_port: u16,
}

fn default_inference_provider() -> String {
    "openai".to_string()
}

fn default_inference_url() -> String {
    "https://api.openai.com/v1/chat/completions".to_string()
}

fn default_inference_model() -> String {
    "gpt-4o-mini".to_string()
}

fn default_http_port() -> u16 {
    3001
}

impl Default for Config {
    fn default() -> Self {
        Self {
            rpc_url: "https://sepolia.base.org".to_string(),
            private_key_path: "~/.siphon/keeper.key".to_string(),
            data_dir: "~/.siphon/data".to_string(),
            listen_port: 9000,
            bootstrap_peers: vec![],
            openai_api_key: None,
            shard_registry_address: None,
            keeper_staking_address: None,
            shard_valuation_address: None,
            loan_vault_address: None,
            inference_provider: default_inference_provider(),
            inference_url: default_inference_url(),
            inference_model: default_inference_model(),
            http_port: default_http_port(),
        }
    }
}

impl Config {
    /// Returns the path to the config file: ~/.siphon/config.toml
    fn config_path() -> PathBuf {
        let home = dirs_fallback();
        home.join(".siphon").join("config.toml")
    }

    /// Load configuration from ~/.siphon/config.toml.
    /// Returns an error if the file doesn't exist or can't be parsed.
    pub fn load() -> Result<Self, String> {
        let path = Self::config_path();
        if !path.exists() {
            return Err(format!(
                "Config file not found at {}. Run `siphon-keeper config init` to create one.",
                path.display()
            ));
        }

        let contents = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;

        let config: Config = toml::from_str(&contents)
            .map_err(|e| format!("Failed to parse config: {}", e))?;

        Ok(config)
    }

    /// Create a default configuration file at ~/.siphon/config.toml.
    /// Also creates the data directory if it doesn't exist.
    /// Returns the path to the created file.
    pub fn create_default() -> Result<String, String> {
        let path = Self::config_path();
        let dir = path.parent().unwrap();

        fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create directory {}: {}", dir.display(), e))?;

        let default_toml = r#"# Siphon Keeper Node Configuration

# JSON-RPC URL for Base Sepolia
rpc_url = "https://sepolia.base.org"

# Path to the keeper's private key file
private_key_path = "~/.siphon/keeper.key"

# Local data directory for SQLite and logs
data_dir = "~/.siphon/data"

# P2P listen port
listen_port = 9000

# Bootstrap peer multiaddrs (add peers to join the network)
bootstrap_peers = []

# OpenAI API key for shard inference (required for hosting shards)
# openai_api_key = "sk-..."

# ShardRegistry contract address on Base Sepolia
# shard_registry_address = "0x..."

# KeeperStaking contract address on Base Sepolia
# keeper_staking_address = "0x..."

# ShardValuation contract address on Base Sepolia
# shard_valuation_address = "0x..."

# LoanVault contract address on Base Sepolia
# loan_vault_address = "0x..."

# Inference provider: "openai", "ollama", or any OpenAI-compatible service
inference_provider = "openai"

# Base URL for the inference API (chat completions endpoint)
inference_url = "https://api.openai.com/v1/chat/completions"

# Model name for inference requests
inference_model = "gpt-4o-mini"

# HTTP API port for the keeper's REST API
http_port = 3001

# --- Ollama example (uncomment to use local inference) ---
# inference_provider = "ollama"
# inference_url = "http://localhost:11434/v1/chat/completions"
# inference_model = "llama3.2"
# openai_api_key = ""
"#;

        fs::write(&path, default_toml)
            .map_err(|e| format!("Failed to write config: {}", e))?;

        // Create data directory
        let data_dir = dir.join("data");
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Failed to create data dir: {}", e))?;

        Ok(path.display().to_string())
    }
}

/// Simple fallback for getting the home directory without adding another dependency.
fn dirs_fallback() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home)
    } else if let Ok(profile) = std::env::var("USERPROFILE") {
        PathBuf::from(profile)
    } else {
        PathBuf::from(".")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_has_expected_values() {
        let cfg = Config::default();
        assert_eq!(cfg.rpc_url, "https://sepolia.base.org");
        assert_eq!(cfg.listen_port, 9000);
        assert_eq!(cfg.http_port, 3001);
        assert_eq!(cfg.inference_provider, "openai");
        assert_eq!(cfg.inference_url, "https://api.openai.com/v1/chat/completions");
        assert_eq!(cfg.inference_model, "gpt-4o-mini");
        assert!(cfg.openai_api_key.is_none());
    }

    #[test]
    fn parse_minimal_toml() {
        let toml_str = r#"
            rpc_url = "https://sepolia.base.org"
            private_key_path = "~/.siphon/keeper.key"
            data_dir = "~/.siphon/data"
            listen_port = 9000
        "#;
        let cfg: Config = toml::from_str(toml_str).unwrap();
        assert_eq!(cfg.http_port, 3001); // default
        assert_eq!(cfg.inference_model, "gpt-4o-mini"); // default
    }

    #[test]
    fn parse_ollama_config() {
        let toml_str = r#"
            rpc_url = "https://sepolia.base.org"
            private_key_path = "~/.siphon/keeper.key"
            data_dir = "~/.siphon/data"
            listen_port = 9000
            inference_provider = "ollama"
            inference_url = "http://localhost:11434/v1/chat/completions"
            inference_model = "llama3.2"
            http_port = 8080
        "#;
        let cfg: Config = toml::from_str(toml_str).unwrap();
        assert_eq!(cfg.inference_provider, "ollama");
        assert_eq!(cfg.inference_url, "http://localhost:11434/v1/chat/completions");
        assert_eq!(cfg.inference_model, "llama3.2");
        assert_eq!(cfg.http_port, 8080);
    }
}
