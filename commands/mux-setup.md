---
name: mux-setup
description: Interactive tier setup wizard for agent-mux
allowed-tools: [spawn_codex, check_budget, get_mux_status, Bash, Read, Write]
---

# /mux-setup command

Guide the user through initial agent-mux configuration. This wizard detects the user's subscription combination and configures optimal routing settings.

## Steps

### Step 1: Detect Codex CLI

Before asking questions, check if Codex CLI is installed:

```bash
command -v codex && codex --version
```

If not installed, show:
```
[agent-mux] Codex CLI not detected.
  Install: npm install -g @openai/codex
  Then run /mux-setup again.
```
Stop here if Codex is not found.

### Step 2: Ask Claude subscription

```
[agent-mux] ═══ Agent Mux Setup ═══

[1/4] Claude Code subscription?
  1) Pro     $20/mo   (~45 msgs/5hr)
  2) Max 5x  $100/mo  (~225 msgs/5hr)
  3) Max 20x $200/mo  (~900 msgs/5hr)
```

Wait for user input (1, 2, or 3).

### Step 3: Ask Codex subscription

```
[2/4] Codex CLI subscription?
  1) Plus  $20/mo   (~200 tasks/day, 1 concurrent)
  2) Pro   $200/mo  (unlimited tasks, 3 concurrent)
```

Wait for user input (1 or 2).

### Step 4: Determine and display tier

Map the subscription combination to a tier:

| Claude | Codex | Tier | Monthly Cost |
|--------|-------|------|-------------|
| Pro $20 | Plus $20 | budget | $40 |
| Max 5x $100 | Plus $20 | standard | $120 |
| Max 20x $200 | Plus $20 | premium | $220 |
| Max 20x $200 | Pro $200 | power | $400 |
| Pro $20 | Pro $200 | budget | $220 (budget routing, power Codex) |
| Max 5x $100 | Pro $200 | standard | $300 (standard routing, power Codex) |

Display the detected tier:

```
[3/4] Detected tier: {tier_name} (${cost}/mo)

  Routing strategy:
    Engine:     {local|hybrid}
    Bias:       {codex|balanced|claude|adaptive}
    Split:      Claude {pct}% / Codex {pct}%

  Features:
    Batch mode:          {ON|OFF}
    Conservation mode:   {ON|OFF}
    Parallel dispatch:   {ON|OFF}
    Task decomposition:  {ON|OFF}
    Concurrent Codex:    {1|3}

  Budget alerts at: {thresholds}%
```

### Step 5: Save configuration

Write the tier-appropriate config to `.agent-mux/config.yaml`:

**Budget ($40/mo):**
```yaml
schema_version: 1
tier: budget
claude_plan: pro
codex_plan: plus
routing:
  engine: local
  bias: codex
  split:
    claude: 30
    codex: 70
  escalation:
    enabled: true
    strategy: fix
    max_retries: 1
batch_mode:
  enabled: true
  queue_timeout_sec: 30
conservation:
  enabled: true
  codex_first_on_uncertain: true
budget:
  claude_msgs_per_5hr: 45
  codex_tasks_per_day: 200
  max_concurrent_codex: 1
  warnings: [50, 75, 90]
  degradation:
    on_claude_exhausted: codex_only
    on_both_exhausted: queue_and_wait
deny_list:
  - ".github/workflows/*"
  - ".env*"
  - "*.pem"
  - "*.key"
  - "package.json"
  - "package-lock.json"
  - "yarn.lock"
  - "pnpm-lock.yaml"
```

**Standard ($120/mo):**
```yaml
schema_version: 1
tier: standard
claude_plan: max5x
codex_plan: plus
routing:
  engine: local
  llm_assist: optional
  bias: balanced
  split:
    claude: 55
    codex: 45
  escalation:
    enabled: true
    strategy: fix
    max_retries: 2
features:
  parallel_dispatch: true
  task_decomposition: false
budget:
  claude_msgs_per_5hr: 225
  codex_tasks_per_day: 200
  max_concurrent_codex: 1
  warnings: [75, 90]
  degradation:
    on_claude_exhausted: codex_only
    on_both_exhausted: queue_and_wait
deny_list:
  - ".github/workflows/*"
  - ".env*"
  - "*.pem"
  - "*.key"
  - "package.json"
  - "package-lock.json"
  - "yarn.lock"
  - "pnpm-lock.yaml"
```

**Premium ($220/mo):**
```yaml
schema_version: 1
tier: premium
claude_plan: max20x
codex_plan: plus
routing:
  engine: hybrid
  llm_assist: always
  bias: claude
  split:
    claude: 70
    codex: 30
  escalation:
    enabled: true
    strategy: fix_then_redo
    max_retries: 3
features:
  parallel_dispatch: true
  task_decomposition: true
  context_pre_gathering: true
budget:
  claude_msgs_per_5hr: 900
  codex_tasks_per_day: 200
  max_concurrent_codex: 1
  warnings: [75, 90]
  degradation:
    on_claude_exhausted: codex_only
    on_both_exhausted: queue_and_wait
deny_list:
  - ".github/workflows/*"
  - ".env*"
  - "*.pem"
  - "*.key"
  - "package.json"
  - "package-lock.json"
  - "yarn.lock"
  - "pnpm-lock.yaml"
```

**Power ($400/mo):**
```yaml
schema_version: 1
tier: power
claude_plan: max20x
codex_plan: pro
routing:
  engine: hybrid
  mode: full_orchestration
  bias: adaptive
  escalation:
    enabled: true
    strategy: full
    max_retries: unlimited
features:
  parallel_dispatch: true
  max_concurrent_codex: 3
  task_decomposition: true
  pipeline_mode: true
budget:
  claude_msgs_per_5hr: 900
  codex_tasks_per_day: unlimited
  max_concurrent_codex: 3
  warnings: [90]
  degradation:
    on_claude_exhausted: codex_only
    on_both_exhausted: queue_and_wait
deny_list:
  - ".github/workflows/*"
  - ".env*"
  - "*.pem"
  - "*.key"
  - "package.json"
  - "package-lock.json"
  - "yarn.lock"
  - "pnpm-lock.yaml"
```

### Step 6: Confirm completion

```
[4/4] Setup complete!

  Tier:   {tier_name} (${cost}/mo)
  Config: .agent-mux/config.yaml

  Quick start:
    /mux "write tests for auth module"     -- routes to Codex
    /mux "design payment architecture"     -- routes to Claude
    /mux-status                            -- check budget
    /mux-config                            -- view/edit settings

  Run /mux-config to fine-tune settings.
═══════════════════════════════
```

### Step 7: Detect sibling plugins

After setup, check for sibling plugins and report:

```bash
for plugin in harness-planner architecture-enforcer harness-docs; do
  ls "$HOME/.claude/plugins/cache/wowoyong/$plugin" 2>/dev/null
done
```

If any found:
```
[agent-mux] Detected sibling plugins: {list}
  Integration will be automatic during routing.
```
