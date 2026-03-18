mod commands;
mod pty;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(pty::PtyManager::new())
        .invoke_handler(tauri::generate_handler![
            commands::spawn_pty,
            commands::write_pty,
            commands::resize_pty,
            commands::kill_pty,
            commands::route_task,
            commands::execute_task,
            commands::get_system_shell,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
