# agent-mux

> AI coding multiplexer that automatically orchestrates Claude Code and Codex CLI

[![npm](https://img.shields.io/npm/v/agent-mux-mcp)](https://www.npmjs.com/package/agent-mux-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://github.com/wowoyong/agent-mux/actions/workflows/ci.yml/badge.svg)](https://github.com/wowoyong/agent-mux/actions)

**English** | [한국어](./README.md)

---

## Why agent-mux?

If you subscribe to both Claude Code and Codex CLI, one sits idle while the other hits its rate limit.

agent-mux eliminates that idle time. It analyzes tasks, automatically routes them to the optimal CLI, and switches to the other when one hits its limit.

**6 hours of coding for $40/month (Pro+Plus). Without agent-mux, you get ~90 minutes.**

| | Without agent-mux | With agent-mux |
|---|:---:|:---:|
| Available time | ~1.5 hours | ~6 hours |
| Tasks completed | ~15 | ~49 |
| Cost per task | $1.33 | $0.82 |

---

## Installation

### Option 1: Standalone CLI (Recommended)

```bash
npm install -g agent-mux-mcp
mux setup
```

### Option 2: Claude Code Plugin

```bash
claude plugin marketplace add wowoyong/agent-mux
claude plugin install agent-mux
```

---

## 30-Second Quick Start

```bash
# 1. Install
npm install -g agent-mux-mcp

# 2. Configure — select Claude plan, Codex plan, auto-detect tier
mux setup

# 3. Interactive mode — enter REPL, type tasks for auto-routing
mux

# 4. One-shot mode
mux "write unit tests for auth module"
# → [agent-mux] Routing → CODEX (test writing, confidence: 92%)
# → Codex working... ✓ Complete — 3 files (34s)
```

---

## Usage

### Interactive Mode (REPL)

```bash
mux
```

Running `mux` without arguments enters the REPL.

```
  ⚡ agent-mux v0.4.0 | standard tier ($120/mo)
  Claude ████████████░░░░░░░░ 12/225 | Codex ██░░░░░░░░░░░░░░░░░░ 3/200

  Type a task to route, or a command:
    /status  — budget dashboard
    /go      — auto-execute mode
    /config  — show configuration
    /help    — show help
    /quit    — exit

mux> write tests for auth module        ← auto-routed
mux> /go build JWT auth system           ← auto-decompose + execute
mux> /status                             ← budget dashboard
mux> /config                             ← show config
mux> /quit                               ← exit
```

Plain text input is automatically routed and executed. The budget bar updates after each execution.

### One-Shot Mode

```bash
# Auto-routing
mux "write unit tests for auth module"

# Preview routing only (no execution)
mux --dry-run "refactor the database module"

# Detailed signal analysis
mux --verbose "fix the login bug"

# Force routing
mux --route=codex "generate API docs"
mux --route=claude "security audit"

# Check budget
mux status

# Configuration
mux setup    # interactive setup wizard
mux config   # print current config as JSON
```

### mux go — The "Just Do It" Command

```bash
mux go "build user dashboard — charts, tables, API integration"
```

```
⚡ mux go — auto-routing + auto-execution

Decomposed into 4 subtasks (fan-out):

  ◆ [1] Design API endpoints        → CLAUDE
  ◆ [2] Implement chart component   → CODEX
  ◆ [3] Implement table component   → CODEX
  ◆ [4] Write API integration code  → CODEX

Phase 1: Claude tasks
  ◆ Design API endpoints
  Claude:
    ...

Phase 2: Codex tasks
  ◆ Implement chart component... (42s, 2 files)
  ◆ Implement table component... (38s, 2 files)
  ◆ Write API integration code... (25s, 1 files)

═══ Complete ═══
Budget: Claude 13/225 | Codex 6/200
```

`mux go` performs the following:

1. **Auto-decomposition** — Splits complex tasks into independent subtasks (using numbered lists, bullets, "and"/"also"/"then" delimiters)
2. **Routing decision** — Assigns each subtask to Claude (design/analysis) or Codex (implementation/testing)
3. **Sequential execution** — Runs Claude tasks first, then Codex tasks
4. **Auto-merge** — Automatically merges Codex results from git worktree (no confirmation prompt)
5. **Escalation** — Automatically escalates to Claude if Codex fails

Simple tasks that don't need decomposition are executed directly by a single agent.

---

## How Routing Works

agent-mux uses a **2-Phase routing engine**. On the Budget tier, routing runs **100% locally** with zero LLM token consumption.

### Phase 1: Hard Rules (Instant Decision)

Conditions are checked in priority order for immediate routing.

| Priority | Condition | Route | Rationale |
|:---:|-----------|-------|-----------|
| 1 | Needs MCP tools | Claude | Only Claude can access MCP |
| 2 | Interactive conversation | Claude | Requires active session |
| 3 | References conversation context | Claude | Prior context only exists in Claude |
| 4 | Standalone security audit | Codex | Systematic auditing is efficient |
| 5 | Multi-file refactoring (>5 files) | Claude | Needs cross-file coordination |
| 6 | Project scaffolding | Claude | Requires architectural understanding |

### Phase 2: Weighted Signal Scoring

If no hard rule matches, 20 signals are scored with weights.

```
score = sum(signal_weight x signal_value) + sum(interaction_modifier)

score > 0  → Codex
score < 0  → Claude
score == 0 → budget_tiebreaker()
```

**Codex-favoring signals (positive):** test writing (+40), self-contained task (+35), security audit (+30), doc generation (+30), code review (+25), refactoring (+20), debugging (+15), terminal task (+10)

**Claude-favoring signals (negative):** needs MCP (-100), conversation context (-100), interactive (-100), scaffolding (-100), architectural design (-40), multi-file orchestration (-35), project context (-30), frontend (-20)

**Interaction modifiers:**
- Refactoring with project context → Claude bias -40
- Self-contained verifiable debugging → Codex bias +30
- Multi-file test writing → Claude bias -20
- Security review + code review → Codex bias +20
- Complex + urgent → Claude bias -25

### Budget Pressure Adjustment

When Claude budget drops below 20%, a +50 bonus pushes toward Codex. When Codex drops below 20%, a -50 bonus pushes toward Claude.

### Learned Overrides

When users manually override routing decisions, the system learns the preference and applies it to similar future tasks (30-second cache TTL).

### Routing Examples

```
mux "write unit tests for auth module"
→ [agent-mux] Routing → CODEX (test writing, confidence: 92%)

mux "design payment system architecture"
→ [agent-mux] Routing → CLAUDE (architectural design, confidence: 95%)

mux "debug this JWT error"
→ [agent-mux] Routing → CLAUDE (debugging, context needed, confidence: 78%)

mux "add JSDoc to all exported functions"
→ [agent-mux] Routing → CODEX (doc generation, confidence: 88%)
```

---

## Supported Tiers

| Tier | Claude | Codex | Monthly | Split | Engine | Bias | Key Value |
|------|--------|-------|:---:|:---:|:---:|:---:|-----------|
| **Budget** | Pro $20 | Plus $20 | $40 | 30:70 | local | codex | 4x coding time |
| **Standard** | Max 5x $100 | Plus $20 | $120 | 55:45 | local | balanced | Parallel workflows |
| **Premium** | Max 20x $200 | Plus $20 | $220 | 70:30 | hybrid | claude | Hands-free routing |
| **Power** | Max 20x $200 | Pro $200 | $400 | 65:35 | hybrid | adaptive | Maximum parallelism |

### Rate Limits by Tier

| Tier | Claude (per 5hr) | Codex (daily) | Concurrent |
|------|:---:|:---:|:---:|
| Budget | 45 | 200 | 1 |
| Standard | 225 | 200 | 1 |
| Premium | 900 | 200 | 1 |
| Power | 900 | Unlimited | 3 |

### Escalation Strategies

| Tier | Strategy | Max Retries |
|------|----------|:---:|
| Budget | fix (patch only) | 1 |
| Standard | fix_then_redo (patch, then re-execute) | 2 |
| Premium | fix_then_redo | 2 |
| Power | full (patch, re-execute, full Claude delegation) | 3 |

---

## Feature Matrix

| Feature | Budget $40 | Standard $120 | Premium $220 | Power $400 |
|---------|:---:|:---:|:---:|:---:|
| Local routing engine | O | O | O | O |
| LLM-assisted routing | - | Optional | Always | Always |
| All CLI commands | O | O | O | O |
| Override flags | O | O | O | O |
| Batch mode | 30s | 15s | 5s | 3s |
| Parallel dispatch | - | O | O | O |
| Auto-escalation | 1x | 2x | 2x | 3x |
| Task decomposition (`mux go`) | O | O | O | O |
| Concurrent Codex | 1 | 1 | 1 | 3 |
| Conservation mode | ON | - | - | - |

---

## Flag Reference

| Flag | Default | Description |
|------|---------|-------------|
| `--dry-run` | OFF | Show routing decision only, no execution |
| `--verbose` | OFF | Show detailed active signal analysis |
| `--route=claude\|codex` | auto | Force routing (100% confidence) |
| `--auto-apply` | OFF | Skip confirmation, auto-apply Codex results |
| `--confirm` | ON (Codex) | Show diff and require approval for Codex results |

---

## Codex Execution Pipeline

Codex tasks run in a safely isolated environment.

```
PREPARE → SPAWN → MONITOR → VALIDATE → INTEGRATE
```

1. **PREPARE** — Create git worktree, fully isolated from main working directory
2. **SPAWN** — Execute via `codex exec --full-auto --json --ephemeral`
3. **MONITOR** — Parse JSONL event stream in real-time, detect 90-second stalls (timeout: 420s)
4. **VALIDATE** — 4-stage verification
   - Stage 1: File scope check (deny-list violation detection)
   - Stage 2: Run tests/lint
   - Stage 3: Claude review
   - Stage 4: User confirmation (skipped with `--auto-apply`)
5. **INTEGRATE** — On approval: `git merge --no-ff`; on rejection: worktree removal + branch rollback

### Diff Preview

Codex results are shown as colorized diffs (max 50 lines preview; type `d` for full diff). Users choose `y` (apply), `n` (discard), or `d` (full diff).

### File Protection (Deny-list)

The following files are automatically blocked from Codex modification:

```
.github/workflows/*    .env*          *.pem         *.key
*.p12                  *.jks          package.json  package-lock.json
yarn.lock              pnpm-lock.yaml Gemfile.lock  poetry.lock
go.sum                 Cargo.lock     Dockerfile    docker-compose*.yml
Makefile               .npmrc         .pypirc       Jenkinsfile
```

Custom patterns can be added via the `deny_list` config key.

### Retry + Escalation

When Codex fails, it automatically retries according to the configured strategy. After exhausting max retries, it escalates to Claude with the failure context included.

---

## Budget Tracking

```bash
mux status
```

```
=== agent-mux Status ===

  Tier: standard ($120/mo)
  Codex CLI: [ok] v0.112.0

  Claude:  ############--------  54/225
  Codex:   ######--------------  12/200

  Routing: local | Bias: balanced | Split: 55/45
```

### Warning System

Configure warning thresholds via `budget.warnings` in the config (default: 50%, 75%, 90%).

- **50%**: Informational notification
- **75%**: Warning — routing bias automatically adjusts
- **90%**: Critical — avoids the exhausted agent

### Exhaustion Behavior

| Situation | Default Action |
|-----------|---------------|
| Claude exhausted | `codex_only` — use Codex exclusively |
| Both exhausted | `queue_and_wait` — queue tasks and wait |

---

## Configuration

### Setup Wizard

```bash
mux setup
```

The interactive wizard asks for your Claude and Codex subscription plans, automatically determines the tier, and saves to `.agent-mux/config.yaml`.

```
=== agent-mux Setup ===

  Codex CLI: [ok] v0.112.0

  Claude plan:
    1) Pro ($20/mo)      -- ~45 messages/5hr
    2) Max 5x ($100/mo)  -- ~225 messages/5hr
    3) Max 20x ($200/mo) -- ~900 messages/5hr

  Select (1-3): 2

  Codex plan:
    1) Plus ($20/mo)  -- 1 concurrent task
    2) Pro ($200/mo)  -- 3 concurrent tasks

  Select (1-2): 1

  Tier: standard ($120/mo)
    Routing: local | 55% Claude / 45% Codex

  Config saved to .agent-mux/config.yaml
```

### Configuration File

Config location: `.agent-mux/config.yaml` (project) or `~/.agent-mux/config.yaml` (global)

```yaml
# .mux-config.yaml (Budget tier defaults)
schema_version: 1
tier: budget  # budget | standard | premium | power

claude:
  plan: pro           # pro | max_5x | max_20x
  cost: 20

codex:
  plan: plus          # plus | pro
  cost: 20
  mode: local         # local | cloud_and_local

routing:
  engine: local       # local | hybrid
  bias: codex         # codex | balanced | claude | adaptive
  split:
    claude: 30
    codex: 70
  escalation:
    enabled: true
    strategy: fix     # fix | fix_then_redo | full
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

# Optional: custom deny-list patterns (appended to defaults)
# deny_list:
#   - "*.secret"
#   - "internal/**"
```

---

## Claude Code Plugin Mode

In addition to the standalone CLI, agent-mux can be used as a Claude Code plugin:

```bash
claude plugin marketplace add wowoyong/agent-mux
claude plugin install agent-mux
# Restart Claude Code, then:
/mux "write tests"
/mux-setup
/mux-status
```

| Plugin Command | Description |
|----------------|-------------|
| `/mux "task"` | Route and execute a task |
| `/mux-status` | View budget and task status |
| `/mux-config` | View or modify settings |
| `/mux-setup` | Interactive setup wizard |

---

## CLI Command Summary

| Command | Description |
|---------|-------------|
| `mux` | Enter REPL interactive mode |
| `mux "<task>"` | Auto-route and execute |
| `mux go "<task>"` | Auto-decompose + route + execute |
| `mux status` | Budget and status dashboard |
| `mux setup` | Interactive setup wizard |
| `mux config` | Print current config as JSON |

---

## Works Great With

agent-mux works **perfectly on its own**. These optional plugins make it even more powerful:

- **[harness-planner](https://github.com/wowoyong/claude-plugin-harness-planner)** — Decomposes complex tasks into mux-ready subtasks
- **[architecture-enforcer](https://github.com/wowoyong/claude-plugin-architecture-enforcer)** — Injects architecture rules into Codex spawns for consistency
- **[harness-docs](https://github.com/wowoyong/claude-plugin-harness-docs)** — Improves routing accuracy with AGENTS.md project context

These plugins are auto-detected at session start. If absent, agent-mux core functionality is unaffected.

---

## Architecture

agent-mux consists of two independent components:

| Component | Form | Role |
|-----------|------|------|
| **Claude Code Plugin** | Markdown (skills, commands, agents, hooks) | User interface, routing decisions, result review |
| **MCP Server** (`agent-mux-mcp`) | TypeScript | Codex process spawning, budget tracking, state management |

```
User → mux "task"
           │
     Task Router (local, 0 tokens)
     ├─ Phase 1: Hard Rules
     └─ Phase 2: Weighted Scoring
           │
     ┌─────┴──────┐
     │            │
Route: Claude  Route: Codex
(claude --print)     │
                spawn_codex (full-auto)
                in git worktree
                     │
                ┌────┴────┐
                │         │
           Success    Failure
           ├ Diff     └ Retry / Escalate
           ├ Confirm      → Claude fallback
           └ Merge
```

---

## Tech Stack

- **TypeScript** — Full core + MCP server
- **MCP (Model Context Protocol)** — Claude Code plugin integration
- **Commander.js** — CLI framework
- **Chalk + Ora** — Terminal UI (colorized output, spinners)
- **Vitest** — Unit tests

---

## Design Philosophy

Inspired by [OpenAI Harness Engineering](https://openai.com) and oh-my-openagent.

- **"Humans steer, agents execute"** — Developers set direction, agents execute
- **Zero-overhead routing** — Zero token consumption for routing on Budget tier. Extracts 20 signals from keyword matching alone
- **Repository as source of truth** — All Codex work is isolated in git worktrees; merge or rollback for clean history
- **Subscription Efficiency Maximizer** — Maximum productivity per subscription dollar. Eliminates rate limit idle time

---

## License

[MIT](LICENSE)

---

## Contributing

Issues and PRs are welcome!

https://github.com/wowoyong/agent-mux/issues
