# agent-mux Demo Script

This script walks through a typical agent-mux session showing routing, budget tracking, and configuration.

## 1. Setup (30 seconds)

```
/mux-setup
```

Interactive setup wizard:

```
[agent-mux] === Setup Wizard ===

? Select your Claude plan: Pro ($20/mo)
? Select your Codex plan:  Plus ($20/mo)

  Detected tier: Budget ($40/mo)
  Recommended bias: codex (70% Codex / 30% Claude)

  Estimated capacity:
    Claude ~45 tasks/month (architecture, multi-file, interactive)
    Codex  ~200 tasks/month (tests, reviews, debugging, docs)

? Accept recommended settings? Yes

[agent-mux] Config saved to .agent-mux/config.yaml
[agent-mux] MCP server ready. Use /mux to route tasks.
```

## 2. Route a test-writing task (Codex)

```
/mux "write unit tests for src/utils/parser.ts"
```

Output:

```
[agent-mux] === Routing Decision ===
  Task:       write unit tests for src/utils/parser.ts
  Target:     Codex
  Confidence: 92%
  Reason:     Test writing + self-contained + verifiable
  Signals:    isTestWriting=true, isSelfContained=true, isVerifiable=true

[agent-mux] Spawning Codex in worktree mux-task-a1b2c3...
  [Codex working... 45s]
  Exit code: 0
  Files modified: 3

[agent-mux] === Result ===
  Status:  SUCCESS
  Branch:  mux/tests-parser-a1b2c3
  Files:
    + src/utils/__tests__/parser.test.ts (new, 12 tests)
    + src/utils/__tests__/parser.edge.test.ts (new, 5 tests)
    ~ src/utils/parser.ts (minor type fix)

  Verification: 17/17 tests passing
  Budget:  Claude 0/45 | Codex 1/200
```

## 3. Route an architecture task (Claude)

```
/mux "design the authentication system architecture"
```

Output:

```
[agent-mux] === Routing Decision ===
  Task:       design the authentication system architecture
  Target:     Claude (handle directly)
  Confidence: 95%
  Reason:     Architecture decision + needs project context + interactive
  Signals:    isArchitectural=true, needsProjectContext=true, isInteractive=true

[agent-mux] This task should be handled by Claude directly.
  Claude will proceed with the architecture design...
```

Claude then handles the task in the current conversation.

## 4. Route a debugging task (Codex)

```
/mux "fix the TypeError in src/api/handler.ts line 42"
```

Output:

```
[agent-mux] === Routing Decision ===
  Task:       fix the TypeError in src/api/handler.ts line 42
  Target:     Codex
  Confidence: 88%
  Reason:     Debugging + self-contained + single file
  Signals:    isDebugging=true, isSelfContained=true, estimatedFiles=1

[agent-mux] Spawning Codex in worktree mux-task-d4e5f6...
  [Codex working... 23s]
  Exit code: 0

[agent-mux] === Result ===
  Status:  SUCCESS
  Branch:  mux/fix-handler-d4e5f6
  Files:
    ~ src/api/handler.ts (1 change)

  Budget:  Claude 1/45 | Codex 2/200
```

## 5. Check budget status

```
/mux-status
```

Output:

```
[agent-mux] === Dashboard ===
  Tier: Budget ($40/mo) | Bias: codex | Period: Mar 1-31

  Claude [Pro $20]     ██░░░░░░░░  2/45 tasks (4%)
  Codex  [Plus $20]    █░░░░░░░░░  2/200 tasks (1%)

  Recent Tasks:
  #1  write unit tests for parser.ts    Codex  SUCCESS   45s
  #2  design auth system architecture   Claude SUCCESS   --
  #3  fix TypeError in handler.ts       Codex  SUCCESS   23s

  No warnings. Budget healthy.
```

## 6. Dry-run mode

```
/mux --dry-run "refactor the database module into separate concerns"
```

Output:

```
[agent-mux] === Dry Run ===
  Task:       refactor the database module into separate concerns
  Target:     Claude (would handle directly)
  Confidence: 78%
  Reason:     Multi-file refactoring + needs project context
  Signals:    isRefactoring=true, isMultiFileOrchestration=true,
              estimatedFiles=5, estimatedComplexity=high

  Note: No action taken (dry-run mode)
```

## 7. Configure routing

```
/mux-config set routing.bias balanced
```

Output:

```
[agent-mux] Updated: routing.bias = balanced
  Split changed: Claude 50% / Codex 50%
```

## 8. Task decomposition (Premium/Power tiers)

```
/mux "add user profile page with avatar upload, settings form, and API endpoints"
```

Output:

```
[agent-mux] === Task Decomposition ===
  Complex task detected (3 subtasks identified)

  #1  API endpoints for profile CRUD    -> Codex   (self-contained)
  #2  Avatar upload with S3 integration -> Claude  (needs context)
  #3  Settings form UI component        -> Claude  (frontend)

  Strategy: parallel (#1 independent, #2 and #3 after #1)

  Proceed? [Y/n]
```

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `/mux "<task>"` | Route a task to the best agent |
| `/mux --dry-run "<task>"` | Preview routing without executing |
| `/mux-setup` | Interactive setup wizard |
| `/mux-status` | Dashboard with budget and task history |
| `/mux-config` | View current configuration |
| `/mux-config set <key> <value>` | Update a setting |
| `/mux-config reset` | Reset to tier defaults |
