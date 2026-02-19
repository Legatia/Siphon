use siphon_keeper::config::Config;
use std::fs;
use std::sync::Mutex;

pub struct AppState {
    pub config: Mutex<Config>,
}

impl AppState {
    pub fn load() -> Self {
        let config = Config::load().unwrap_or_default();
        Self {
            config: Mutex::new(config),
        }
    }
}

/// Save a Config to ~/.siphon/config.toml (reuses Config::config_path)
pub fn save_config(config: &Config) -> Result<(), String> {
    let path = Config::config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    let toml_str =
        toml::to_string_pretty(config).map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&path, toml_str).map_err(|e| format!("Failed to write config: {}", e))?;
    Ok(())
}
