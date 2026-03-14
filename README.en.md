# agent-mux

> A Claude Code plugin that intelligently routes tasks between Claude Code and Codex CLI

[![npm](https://img.shields.io/npm/v/agent-mux-mcp)](https://www.npmjs.com/package/agent-mux-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**English** | [한국어](./README.md)

---

## 30-Second Quick Start

```bash
# 1. Install
claude plugin add wowoyong/agent-mux

# 2. Configure
/mux-setup

# 3. Use
/mux "Write unit tests"
→ Codex: test writing, confidence: 92%
```

---

## Why agent-mux?

Claude Code and Codex CLI each have **independent rate limits**. When one is exhausted, you wait. agent-mux eliminates that idle time by routing tasks to the optimal CLI and switching over when one hits its limit.

**6 hours of coding for $40/month (Pro + Plus).** Without agent-mux, you get ~90 minutes.

| | Without agent-mux | With agent-mux |
|---|---|---|
| Available time | ~1.5 hours | ~6 hours |
| Tasks completed | ~15 | ~49 |
| Additional cost | $0 | +$20 (Codex) |
| Cost per task | $1.33 | $0.82 |

---

## Supported Tiers

| Tier | Claude | Codex | Monthly | Key Value |
|------|--------|-------|---------|-----------|
| **Budget** | Pro $20 | Plus $20 | **$40** | 4x coding time |
| **Standard** | Max 5x $100 | Plus $20 | **$120** | Parallel workflows |
| **Premium** | Max 20x $200 | Plus $20 | **$220** | Hands-free routing |
| **Power** | Max 20x $200 | Pro $200 | **$400** | Maximum parallelism |

---

## How Routing Works

agent-mux uses a **2-Phase routing engine** to assign tasks to the optimal CLI.

### Phase 1: Hard Rules (Instant Decision)

Clear-cut conditions are routed immediately without scoring.

| Condition | Decision | Rationale |
|-----------|----------|-----------|
| Needs MCP tools | Claude | Only Claude Code can access MCP |
| Interactive conversation | Claude | Requires active session |
| Needs conversation context | Claude | Prior context only exists in Claude |
| Single-file security audit | Codex | Systematic auditing is efficient |
| Multi-file refactoring | Claude | Requires project-wide context |
| Project scaffolding | Claude | Needs architectural understanding |

### Phase 2: Weighted Scoring

If no hard rule matches, 20 signals are scored with weights.

```
score = sum(signal_weight x signal_value) + sum(interaction_modifier)

score > 0  → Codex
score < 0  → Claude
score == 0 → budget_tiebreaker()
```

### Routing Examples

```
/mux "Write unit tests for auth module"
→ Codex: test writing, confidence: 92%

/mux "Design payment system architecture"
→ Claude: architectural design, confidence: 95%

/mux "Debug this JWT error"
→ Claude: debugging (context needed), confidence: 78%

/mux "Add JSDoc to all exported functions"
→ Codex: doc generation, confidence: 88%
```

On the Budget tier, routing runs **100% locally** with zero LLM token consumption.

---

## Commands

| Command | Description |
|---------|-------------|
| `/mux "task"` | Route and execute a task |
| `/mux-status` | View budget and task status |
| `/mux-config` | View or modify settings |
| `/mux-setup` | Interactive setup wizard |

---

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--confirm` | ON (Codex) | Show diff and require approval |
| `--auto-apply` | OFF | Skip confirmation (deny-list files always require approval) |
| `--dry-run` | OFF | Show routing decision only, no execution |
| `--verbose` | OFF | Show detailed signal analysis |
| `--route=claude\|codex` | auto | Force route to a specific CLI |

---

## Works Great With

agent-mux works **perfectly on its own**. These optional plugins make it even more powerful:

- **[harness-planner](https://github.com/wowoyong/claude-plugin-harness-planner)** — Decomposes complex tasks into mux-ready subtasks
- **[architecture-enforcer](https://github.com/wowoyong/claude-plugin-architecture-enforcer)** — Injects architecture rules into Codex spawns for consistency
- **[harness-docs](https://github.com/wowoyong/claude-plugin-harness-docs)** — Improves routing accuracy with AGENTS.md project context

These plugins are auto-detected at session start. If absent, agent-mux core functionality is unaffected.

---

## Configuration

Create `.mux-config.yaml` in your project root, or run `/mux-setup`.

```yaml
# .mux-config.yaml (Budget tier defaults)
schema_version: 1
tier: budget

claude:
  plan: pro
  cost: 20

codex:
  plan: plus
  cost: 20
  mode: local

routing:
  engine: local        # local | hybrid
  bias: codex          # codex | balanced | claude | adaptive
  split:
    claude: 30
    codex: 70
  escalation:
    enabled: true
    strategy: fix      # fix | fix_then_redo | full
    max_retries: 1

batch_mode:
  enabled: true
  queue_timeout_sec: 30

conservation:
  enabled: true
  codex_first_on_uncertain: true

budget:
  warnings: [50, 75, 90]
  degradation:
    on_claude_exhausted: codex_only
    on_both_exhausted: queue_and_wait
```

See [`.mux-config.yaml.example`](./.mux-config.yaml.example) for the full example.

---

## Feature Matrix

| Feature | Budget $40 | Standard $120 | Premium $220 | Power $400 |
|---------|:---:|:---:|:---:|:---:|
| Local routing engine | O | O | O | O |
| LLM-assisted routing | - | Optional | Always | Always |
| All `/mux` commands | O | O | O | O |
| Override flags | O | O | O | O |
| Batch mode | 30s | 15s | 5s | 3s |
| Parallel dispatch | - | O | O | O |
| Auto-escalation | 1x | 2x | 3x | Unlimited |
| Task decomposition | - | - | O | N-way |
| Concurrent Codex | 1 | 1 | 1 | 3 |
| Conservation mode | ON | - | - | - |
| Pipeline orchestration | - | - | - | fan-out/in |

---

## Codex Execution Pipeline

Codex tasks run through a **5-stage pipeline**:

```
PREPARE → SPAWN → MONITOR → VALIDATE → INTEGRATE
```

1. **PREPARE** — Create git worktree, compose prompt + context
2. **SPAWN** — Execute Codex CLI in full-auto mode
3. **MONITOR** — Parse JSONL event stream in real-time, detect 90s stalls
4. **VALIDATE** — 4-stage verification (file scope / tests,lint / Claude review / user confirm)
5. **INTEGRATE** — Merge worktree branch or rollback

---

## Security

- Codex runs **isolated in a git worktree** (network disabled, .git read-only)
- **Automatic deny-list** protection: `.github/workflows/*`, `.env*`, `*.pem`, `*.key`, dependency manifests
- **Dependency file modifications** always require explicit user approval, regardless of `--auto-apply`
- Codex CLI version pinning for stability

---

## Architecture

agent-mux consists of two independent components:

| Component | Form | Role |
|-----------|------|------|
| **Claude Code Plugin** | Markdown (skills, commands, agents, hooks) | User interface, routing decisions, result review |
| **MCP Server** (`agent-mux-mcp`) | TypeScript | Codex process spawning, budget tracking, state management |

```
User → /mux "task" → Plugin (Skill/Command)
                        │
                  Task Router (local, 0 tokens)
                        │
              ┌─────────┴─────────┐
              │                   │
         Route: Claude       Route: Codex
         (self-execute)           │
                            MCP: spawn_codex
                                  │
                            Codex CLI (full-auto)
                            in git worktree
                                  │
                            Result → codex-reviewer
                                  │
                            Pass → apply (or --confirm)
                            Fail → retry or Claude fallback
```

---

## Design Philosophy

Inspired by OpenAI Harness Engineering and oh-my-openagent.

- **"Humans steer, agents execute"** — Developers set direction, agents execute
- **Repository as source of truth** — All results are recorded in the repository via git worktrees
- **Zero-overhead routing** — Zero token consumption for routing on the Budget tier

---

## License

[MIT](LICENSE)
