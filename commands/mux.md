---
name: mux
description: Route and execute a task via Claude or Codex CLI
allowed-tools: [spawn_codex, check_budget, get_mux_status, Bash, Read, Write, Edit, Glob, Grep]
---

# /mux command

Parse the user's input and execute the mux routing workflow.

## Input format
```
/mux "task description" [--dry-run] [--verbose] [--route=claude|codex] [--auto-apply] [--confirm]
```

## Steps

### 1. Parse input
Extract the task description (quoted string) and any flags from the user's input.

Available flags:
- `--dry-run`: Analyze and show routing decision without executing
- `--verbose`: Show detailed signal analysis
- `--route=claude|codex`: Force routing to a specific CLI
- `--auto-apply`: Skip confirmation for Codex results (deny-list files still require approval)
- `--confirm`: Show diff before applying Codex results (default: ON)

### 2. Check budget
Call `get_mux_status` MCP tool to retrieve:
- Current tier (budget/standard/premium/power)
- Claude messages used and estimated total
- Codex tasks used and estimated total
- Budget recommendation (normal/conserve/codex_only/queue)
- Any running tasks

If budget recommendation is `codex_only`, force route to Codex unless `--route=claude` is explicitly set.
If budget recommendation is `queue`, warn the user that both CLIs are near capacity.

### 3. Analyze the task
Determine routing using the 2-Phase decision process:

**Phase 1 -- Hard Rules (check in priority order):**
1. Task needs MCP tools (database queries, API calls, web fetch) -> Claude
2. Task requires interactive dialogue or follow-up questions -> Claude
3. Task needs previous conversation context -> Claude
4. Task is a standalone security audit (single file/module) -> Codex
5. Task is refactoring affecting >5 files -> Claude
6. Task is scaffolding (project/module structure creation) -> Claude

**Phase 2 -- Weighted Scoring (only if no hard rule matched):**
1. Extract keyword signals from task description using pattern matching
2. Compute weighted score from all detected signals
3. Apply interaction modifiers for signal combinations
4. Factor in budget status (at Budget tier, ties go to Codex)
5. Determine target and confidence percentage

### 4. Display routing decision
```
[agent-mux] Routing -> {target} ({reason}, confidence: {pct}%)
```

If `--verbose`, also display:
```
[agent-mux] === Signal Analysis ===
  Codex signals: {list with weights}
  Claude signals: {list with weights}
  Interaction modifiers: {list}
  Raw score: {score}
  Budget factor: {factor}
  Final: {target} @ {confidence}%
```

If `--dry-run`, stop here. Do not execute the task.

### 5. Execute the task

**If routed to Claude:**
- Execute the task directly in the current Claude Code session
- Use all available tools (Bash, Read, Write, Edit, Glob, Grep, and any MCP tools)
- After completion, call `check_budget` and display updated budget

**If routed to Codex:**
1. Call `spawn_codex` MCP tool with:
   - `prompt`: the task description, enriched with relevant context
   - `complexity`: estimated from task analysis (low/medium/high)
   - `timeout`: 180000ms (low), 420000ms (medium), 480000ms (high, capped at 480000 for Plus plan)
   - `contextFiles`: any files referenced in the task
   - `verifyStrategy`: inferred from task type (tests/lint/diff-review/none)
2. Show progress while waiting:
   ```
   [agent-mux] ████████░░░░░░░░ Codex working... ({elapsed}s)
   ```
3. When Codex completes, check the result:
   - **Success with no denied files**: show modified files and diff summary
   - **Denied files detected**: warn user, list the denied files, ask for explicit approval
   - **Failure**: show error, attempt 1 retry with adjusted prompt, then offer Claude fallback
4. If `--confirm` (default ON): show diff summary and ask user to approve
5. If approved or `--auto-apply`: merge the worktree branch into current branch
6. If rejected: rollback the worktree

### 6. Display updated budget
```
[agent-mux] Budget: Claude {used}/{total} | Codex {used}/{total}
```

Show budget warnings if thresholds are crossed (50%, 75%, 90%, 100%).

## Error Handling

| Error | Action |
|-------|--------|
| Codex CLI not found | Warn user, suggest installation, fall back to Claude |
| Codex process timeout | Kill process, warn user, offer Claude fallback |
| Codex process stall (90s no output) | Kill process, retry 1x, then Claude fallback |
| Codex process crash | Report exit code and stderr, retry 1x, then Claude fallback |
| Worktree creation failed | Report git error, fall back to Claude |
| Both CLIs exhausted | Queue task, show estimated reset time |

## Escalation Chain
```
Codex attempt -> Codex retry (1x) -> Claude fallback (FIX mode) -> User notification
```

FIX mode: Pass Codex's partial output and error to Claude, asking Claude to fix the specific issue rather than redo the entire task. This typically costs 1-2 Claude messages instead of 3-8 for a full redo.
