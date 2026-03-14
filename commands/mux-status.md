---
name: mux-status
description: Show agent-mux budget, task stats, and system status
allowed-tools: [get_mux_status, check_budget]
---

# /mux-status

Call the `get_mux_status` MCP tool and display results as a formatted dashboard.

## Display Format

Show this dashboard format to the user:

```
[agent-mux] ═══ Agent Mux Status ═══

  Tier: {tier} ({claude_plan} + {codex_plan})
  Session: {session_duration} elapsed

  ┌─ Budget ─────────────────────────────────┐
  │ Claude:  {progress_bar}  {used}/{total}  │
  │ Codex:   {progress_bar}  {used}/{total}  │
  └──────────────────────────────────────────┘

  Session Stats:
  ├─ Total tasks: {total}
  ├─ Claude: {claude_count} tasks
  ├─ Codex: {codex_count} tasks ({success_rate}% success)
  └─ Escalations: {escalation_count}

  Warnings: {warnings_list or "none"}

  Detected Plugins: {plugin_list or "none"}
  Codex CLI: {version or "not installed"}
```

## Progress Bar Format
Use block characters to create a visual progress bar:
- Under 50%: ████░░░░░░░░░░░░░░░░ (green feeling)
- 50-74%: ████████████░░░░░░░░ (normal)
- 75-89%: ██████████████████░░ ⚠️ (warning)
- 90%+: ████████████████████ 🚨 (critical)

## Budget Tier-Specific Behavior
- Budget ($40): Show "CONSERVE" label if >50% used
- Standard ($120): Normal display
- Premium ($220): Minimal warnings
- Power ($400): Relaxed display

If there are active warnings, display them prominently below the budget section.
