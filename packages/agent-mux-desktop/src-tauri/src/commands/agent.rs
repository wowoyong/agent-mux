use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct RoutingResult {
    target: String,
    confidence: f64,
    reason: String,
}

#[tauri::command]
pub async fn route_task(
    task: String,
    agent: Option<String>,
) -> Result<RoutingResult, String> {
    // TODO: Connect to agent-mux-mcp sidecar for actual routing
    // For now, return a mock result
    let target = agent.unwrap_or_else(|| {
        if task.len() > 100 || task.contains("architect") || task.contains("design") {
            "claude".to_string()
        } else {
            "codex".to_string()
        }
    });

    Ok(RoutingResult {
        target: target.clone(),
        confidence: 0.85,
        reason: format!("Routed to {} based on task analysis", target),
    })
}

#[tauri::command]
pub async fn execute_task(
    task: String,
    agent: String,
    cwd: String,
) -> Result<String, String> {
    // TODO: Connect to agent-mux-mcp sidecar
    Ok(format!("Task '{}' queued for {} in {}", task, agent, cwd))
}
