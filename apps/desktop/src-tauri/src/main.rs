// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod state;

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("siphon_keeper=info".parse().unwrap())
                .add_directive("siphon_desktop=info".parse().unwrap()),
        )
        .init();

    let app_state = state::AppState::load();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::execute_shell,
            commands::read_file,
            commands::write_file,
            commands::llm_chat,
            commands::agent_loop,
            commands::get_config,
            commands::save_config,
            commands::list_shards,
            commands::get_user_tier,
            commands::list_job_templates,
            commands::run_job_template,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Siphon desktop app");
}
