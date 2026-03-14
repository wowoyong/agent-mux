---
name: mux-status
description: Show current agent-mux budget and task status
allowed-tools: [check_budget, get_mux_status]
---

# /mux-status command

Display the current budget status, running tasks, and session statistics.

## Steps

1. Call `get_mux_status` MCP tool to retrieve full system state
2. Format and display the status dashboard

## Output format

```
[agent-mux] ═══ Agent Mux Status ═══
  Tier: {tier} ({claude_plan} + {codex_plan})
  Session: {elapsed} elapsed

  Budget:
  Claude:  {progress_bar}  {used}/{total} ({pct}%)
  Codex:   {progress_bar}  {used}/{total} ({pct}%)

  Recommendation: {recommendation}

  Running Tasks: {count}
  {task_list_or_none}

  Session Stats:
  Claude messages: {claude_msg_count}
  Codex tasks:     {codex_task_count}
  Escalations:     {escalation_count}

  Detected Plugins: {plugin_list_or_none}
═══════════════════════════════
```

## Progress bar format

Use block characters to render a 16-character progress bar:
- `█` for used portion
- `░` for remaining portion

Examples:
- 25%: `████░░░░░░░░░░░░`
- 50%: `████████░░░░░░░░`
- 75%: `████████████░░░░`
- 90%: `██████████████░░` (with warning color indicator)

## Budget recommendation display

| Recommendation | Display |
|----------------|---------|
| normal | `Normal -- routing as configured` |
| conserve | `Conserving -- shifting to Codex-first` |
| codex_only | `Codex-only mode -- Claude budget near limit` |
| queue | `Queueing -- both CLIs near capacity. Reset in {time}` |

## Running task display

For each active task, show:
```
  [{taskId}] {target} | {status} | {elapsed}s elapsed
```

If no tasks are running:
```
  No active tasks
```

## Detected plugins display

List any detected sibling plugins:
```
  harness-planner, architecture-enforcer, harness-docs
```

If none detected:
```
  None (standalone mode)
```
