use crate::pty::PtyManager;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

#[derive(Clone, Serialize)]
struct PtyOutputEvent {
    id: String,
    data: String,
}

#[tauri::command]
pub async fn spawn_pty(
    app: AppHandle,
    state: State<'_, PtyManager>,
    cwd: String,
    shell: Option<String>,
) -> Result<String, String> {
    let shell_path = shell.unwrap_or_else(|| get_default_shell());
    let id = state.spawn(&shell_path, &cwd).map_err(|e| e.to_string())?;

    // Start reading output in background
    let pty_id = id.clone();
    let manager = state.inner().clone();
    let app_handle = app.clone();

    tokio::spawn(async move {
        let mut buf = [0u8; 4096];
        loop {
            match manager.read(&pty_id, &mut buf) {
                Ok(n) if n > 0 => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit(
                        "pty-output",
                        PtyOutputEvent {
                            id: pty_id.clone(),
                            data,
                        },
                    );
                }
                Ok(_) => {
                    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                }
                Err(_) => break,
            }
        }
    });

    Ok(id)
}

#[tauri::command]
pub async fn write_pty(
    state: State<'_, PtyManager>,
    id: String,
    data: String,
) -> Result<(), String> {
    state
        .write(&id, data.as_bytes())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn resize_pty(
    state: State<'_, PtyManager>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.resize(&id, cols, rows).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn kill_pty(state: State<'_, PtyManager>, id: String) -> Result<(), String> {
    state.kill(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_system_shell() -> String {
    get_default_shell()
}

fn get_default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
}
