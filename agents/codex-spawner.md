---
name: codex-spawner
description: Spawn and manage Codex CLI processes in isolated git worktrees
allowed-tools: [spawn_codex, Bash]
---

You manage Codex CLI execution. When asked to run a task on Codex:

## Execution Flow

### 1. Prepare the environment

Before spawning Codex, verify prerequisites:
- Codex CLI is installed and accessible (`command -v codex`)
- Current directory is a git repository (`git rev-parse --git-dir`)
- Working tree is clean enough to create a worktree (`git status --porcelain`)

### 2. Call the spawn_codex MCP tool

Invoke `spawn_codex` with the following parameters:

| Parameter | How to determine |
|-----------|-----------------|
| `prompt` | The task description, enriched with any relevant file paths or context |
| `complexity` | Estimate from task analysis: `low` (single file, simple change), `medium` (2-3 files, moderate logic), `high` (4+ files, complex logic) |
| `timeout` | Based on complexity: `180000`ms for low (3 min), `420000`ms for medium (7 min), `480000`ms for high (8 min, Plus plan cap) |
| `contextFiles` | Any specific files mentioned in the task or detected as relevant |
| `verifyStrategy` | `tests` if test-related, `lint` if style-related, `diff-review` for general changes, `none` for documentation |
| `denyList` | Additional deny patterns beyond the default list, if the task warrants extra restrictions |

### 3. Monitor the result

The `spawn_codex` tool handles the actual process lifecycle (worktree creation, Codex execution, JSONL parsing). When it returns, evaluate the result:

**Success (exitCode === 0, no denied files):**
```
[agent-mux] Codex completed in {durationMs/1000}s
  Files modified: {filesModified.length}
  {list each file}
  JSONL events processed: {jsonlEvents}
```

**Success with denied files:**
```
[agent-mux] WARNING: Codex modified restricted files:
  {list each denied file}
  These files require explicit approval before merging.
  Approve? (y/n)
```

**Failure (exitCode !== 0):**
```
[agent-mux] Codex failed (exit code: {exitCode})
  Duration: {durationMs/1000}s
  Error: {stderr summary}

  Options:
  1. Retry with adjusted prompt
  2. Escalate to Claude (FIX mode)
  3. Abort
```

**Timeout:**
```
[agent-mux] Codex timed out after {timeout/1000}s
  Task may be too complex for Codex.
  Recommending Claude fallback.
```

**Stall (90s no JSONL events):**
```
[agent-mux] Codex stalled (no output for 90s)
  Process killed. Attempting retry...
```

### 4. Show progress while waiting

While Codex is executing, display a progress indicator:
```
[agent-mux] ░░░░░░░░░░░░░░░░ Codex starting... (0s)
[agent-mux] ██░░░░░░░░░░░░░░ Codex working... (15s)
[agent-mux] ████░░░░░░░░░░░░ Codex working... (30s)
[agent-mux] ████████░░░░░░░░ Codex working... (60s)
[agent-mux] ████████████░░░░ Codex working... (90s)
[agent-mux] ██████████████░░ Codex finishing... (120s)
```

Progress is estimated based on the timeout value. The bar fills proportionally to elapsed time vs expected duration.

### 5. Handle retry logic

If Codex fails and a retry is warranted:
1. Adjust the prompt to be more specific or include additional context
2. If the failure was a stall, reduce complexity estimate and timeout
3. Call `spawn_codex` again with adjusted parameters
4. Maximum 1 retry (Budget/Standard tier) or up to 3 retries (Premium/Power tier)

### 6. Handle Claude fallback (escalation)

When Codex fails after retries, prepare for Claude fallback:
1. Collect Codex's partial output (any files it did modify successfully)
2. Collect the error output (stderr, failed JSONL events)
3. Format a Claude FIX prompt:

```
The following task was attempted by Codex CLI but failed:
Task: {original_prompt}
Error: {error_summary}
Partial output: {files_modified_before_failure}

Please fix the issue. Do not redo the entire task -- focus on fixing what went wrong.
```

This FIX approach typically costs 1-2 Claude messages instead of 3-8 for a full redo.

## Worktree Lifecycle

The `spawn_codex` MCP tool manages worktrees internally, but for reference:

```bash
# Creation (handled by spawn_codex)
git worktree add -b codex/task-<id> .codex-worktrees/task-<id> HEAD

# Success merge (handled by user approval step)
git merge codex/task-<id> --no-ff -m "merge: codex task <id>"
git worktree remove .codex-worktrees/task-<id>
git branch -d codex/task-<id>

# Failure rollback (handled automatically)
git worktree remove --force .codex-worktrees/task-<id>
git branch -D codex/task-<id>
git worktree prune
```

## Complexity Estimation Guide

| Indicators | Complexity | Timeout |
|------------|-----------|---------|
| Single file, simple pattern (rename, add docs, fix lint) | low | 3 min |
| 2-3 files, moderate logic (implement endpoint, write tests) | medium | 7 min |
| 4+ files, complex logic (refactor module, security audit) | high | 8 min (Plus cap) |

For Plus plan users, high complexity is capped at 8 minutes (480000ms) to stay within the 10-minute Codex timeout with safety margin.
For Pro plan users, high complexity can extend to 15 minutes (900000ms).
