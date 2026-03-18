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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn route_task_default() {
        let result = route_task("fix a small bug".to_string(), None).await;
        assert!(result.is_ok());
        let r = result.unwrap();
        // Short task without "architect"/"design" -> codex
        assert_eq!(r.target, "codex");
        assert!(r.confidence > 0.0);
        assert!(r.reason.contains("codex"));
    }

    #[tokio::test]
    async fn route_task_claude() {
        let result = route_task("anything".to_string(), Some("claude".to_string())).await;
        assert!(result.is_ok());
        let r = result.unwrap();
        assert_eq!(r.target, "claude");
        assert!(r.reason.contains("claude"));
    }

    #[tokio::test]
    async fn route_task_codex() {
        let result = route_task("anything".to_string(), Some("codex".to_string())).await;
        assert!(result.is_ok());
        let r = result.unwrap();
        assert_eq!(r.target, "codex");
        assert!(r.reason.contains("codex"));
    }

    #[tokio::test]
    async fn route_task_long_text() {
        // Task longer than 100 chars should route to claude by default
        let long_task = "a".repeat(150);
        let result = route_task(long_task, None).await;
        assert!(result.is_ok());
        let r = result.unwrap();
        assert_eq!(r.target, "claude");
    }

    #[tokio::test]
    async fn execute_task_format() {
        let result = execute_task(
            "build feature".to_string(),
            "claude".to_string(),
            "/home/user/project".to_string(),
        )
        .await;
        assert!(result.is_ok());
        let msg = result.unwrap();
        assert_eq!(msg, "Task 'build feature' queued for claude in /home/user/project");
    }
}
