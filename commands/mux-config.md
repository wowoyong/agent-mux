---
name: mux-config
description: View or modify agent-mux routing configuration
allowed-tools: [Bash, Read, Write, Edit]
---

# /mux-config command

View or modify the routing configuration stored in `.agent-mux/config.yaml`.

## Usage

- `/mux-config` -- show current configuration
- `/mux-config set <key> <value>` -- update a specific setting
- `/mux-config reset` -- reset configuration to tier defaults

## Implementation Steps

### Step 1: Parse the subcommand

Look at the user's input after `/mux-config`:
- No arguments → **show config**
- `set <key> <value>` → **update setting**
- `reset` → **reset to defaults**

### Step 2: Locate the config file

The config file is at `.agent-mux/config.yaml` relative to the project root.

```bash
# Find the project root (where .agent-mux/ lives or should live)
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CONFIG_DIR="$PROJECT_ROOT/.agent-mux"
CONFIG_FILE="$CONFIG_DIR/config.yaml"
```

---

## Show current config (`/mux-config`)

1. Read `.agent-mux/config.yaml` from the project root using the Read tool.
2. If the file does not exist, inform the user and show default configuration for the Budget tier.
3. Parse the YAML content and display it in this exact format:

```
[agent-mux] ═══ Configuration ═══
  Config file: .agent-mux/config.yaml

  Tier: {tier}

  Routing:
    engine:   {local|hybrid}
    bias:     {codex|balanced|claude|adaptive}
    split:    Claude {claude_pct}% / Codex {codex_pct}%

  Escalation:
    enabled:     {true|false}
    strategy:    {fix|fix_then_redo|full}
    max_retries: {n}

  Features:
    batch_mode:          {on|off}
    conservation_mode:   {on|off}
    parallel_dispatch:   {on|off}
    task_decomposition:  {on|off}

  Budget Warnings: {thresholds}

  Deny List:
    {deny_list_entries, one per line}
═══════════════════════════════
```

For features, check these YAML keys:
- `batch_mode.enabled` → batch_mode
- `conservation.enabled` → conservation_mode
- `parallel_dispatch.enabled` → parallel_dispatch (default: off unless Standard+ tier)
- `task_decomposition.enabled` → task_decomposition (default: off unless Premium+ tier)

---

## Set a value (`/mux-config set <key> <value>`)

### Step 1: Parse the key and value

The key uses dot notation. Split by `.` to get the path into the YAML structure.

### Step 2: Validate the key and value

Use this validation table:

| Key | YAML Path | Allowed Values | Type |
|-----|-----------|---------------|------|
| `routing.engine` | `routing.engine` | `local`, `hybrid` | string |
| `routing.bias` | `routing.bias` | `codex`, `balanced`, `claude`, `adaptive` | string |
| `routing.split.claude` | `routing.split.claude` | 0-100 (integer) | number |
| `routing.split.codex` | `routing.split.codex` | 0-100 (integer) | number |
| `escalation.enabled` | `routing.escalation.enabled` | `true`, `false` | boolean |
| `escalation.strategy` | `routing.escalation.strategy` | `fix`, `fix_then_redo`, `full` | string |
| `escalation.max_retries` | `routing.escalation.max_retries` | 0-10 (integer) | number |
| `features.batch_mode` | `batch_mode.enabled` | `true`, `false` | boolean |
| `features.conservation_mode` | `conservation.enabled` | `true`, `false` | boolean |
| `features.parallel_dispatch` | `parallel_dispatch.enabled` | `true`, `false` | boolean |
| `features.task_decomposition` | `task_decomposition.enabled` | `true`, `false` | boolean |
| `budget.warnings` | `budget.warnings` | comma-separated integers (e.g., `50,75,90`) | array |

If the key is not recognized, show an error:
```
[agent-mux] Error: Unknown config key "{key}"
  Available keys: routing.engine, routing.bias, routing.split.claude, routing.split.codex,
    escalation.enabled, escalation.strategy, escalation.max_retries,
    features.batch_mode, features.conservation_mode, features.parallel_dispatch,
    features.task_decomposition, budget.warnings
```

If the value is invalid, show an error:
```
[agent-mux] Error: Invalid value "{value}" for {key}
  Allowed: {allowed_values}
```

### Step 3: Special validation for split values

When setting `routing.split.claude` or `routing.split.codex`:
1. Parse the value as an integer.
2. The complementary value must be set to `100 - value`.
3. Update BOTH values in the config file.
4. Show confirmation:
```
[agent-mux] Updated: routing.split.claude = {value}
  Auto-adjusted: routing.split.codex = {100 - value}
```

### Step 4: Read the existing config file

```bash
cat .agent-mux/config.yaml
```

If the file doesn't exist, create it from the default template (see below) first.

### Step 5: Update the value

Use the Edit tool to find and replace the specific YAML key-value pair.

For simple values:
- Find the line containing the key and replace the value portion.

For nested values (like `routing.split.claude`):
- Navigate the YAML structure and update the correct nested key.

For array values (like `budget.warnings`):
- Replace the entire array line, e.g., `warnings: [50, 75, 90]`

### Step 6: Confirm the change

```
[agent-mux] Updated: {key} = {value}
```

---

## Reset to defaults (`/mux-config reset`)

### Step 1: Detect the current tier

Read the existing config to find the `tier` value. If no config exists, default to `budget`.

### Step 2: Generate the default config for the tier

#### Budget tier ($40/mo: Pro + Plus)
```yaml
schema_version: 1
tier: budget
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
parallel_dispatch:
  enabled: false
task_decomposition:
  enabled: false
budget:
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

#### Standard tier ($220/mo: Max5x + Pro)
```yaml
schema_version: 1
tier: standard
routing:
  engine: local
  bias: balanced
  split:
    claude: 55
    codex: 45
  escalation:
    enabled: true
    strategy: fix_then_redo
    max_retries: 2
batch_mode:
  enabled: false
  queue_timeout_sec: 10
conservation:
  enabled: false
  codex_first_on_uncertain: false
parallel_dispatch:
  enabled: true
  max_concurrent: 3
task_decomposition:
  enabled: false
budget:
  warnings: [60, 80, 95]
  degradation:
    on_claude_exhausted: codex_fallback
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

#### Premium tier ($400/mo: Max20x + Pro)
```yaml
schema_version: 1
tier: premium
routing:
  engine: hybrid
  bias: claude
  split:
    claude: 70
    codex: 30
  escalation:
    enabled: true
    strategy: full
    max_retries: 3
batch_mode:
  enabled: false
  queue_timeout_sec: 5
conservation:
  enabled: false
  codex_first_on_uncertain: false
parallel_dispatch:
  enabled: true
  max_concurrent: 5
task_decomposition:
  enabled: true
  max_subtasks: 5
budget:
  warnings: [70, 85, 95]
  degradation:
    on_claude_exhausted: codex_fallback
    on_both_exhausted: queue_and_wait
deny_list:
  - ".github/workflows/*"
  - ".env*"
  - "*.pem"
  - "*.key"
```

#### Power tier ($600/mo: Max20x + Pro with full features)
```yaml
schema_version: 1
tier: power
routing:
  engine: hybrid
  bias: adaptive
  split:
    claude: 60
    codex: 40
  escalation:
    enabled: true
    strategy: full
    max_retries: 5
batch_mode:
  enabled: false
  queue_timeout_sec: 0
conservation:
  enabled: false
  codex_first_on_uncertain: false
parallel_dispatch:
  enabled: true
  max_concurrent: 10
task_decomposition:
  enabled: true
  max_subtasks: 10
pipeline_mode:
  enabled: true
  auto_chain: true
budget:
  warnings: [80, 90, 98]
  degradation:
    on_claude_exhausted: codex_fallback
    on_both_exhausted: notify_and_continue
deny_list:
  - ".env*"
  - "*.pem"
  - "*.key"
```

### Step 3: Write the config file

Create `.agent-mux/` directory if it doesn't exist, then write the config file.

### Step 4: Confirm

```
[agent-mux] Configuration reset to {tier} tier defaults
```

---

## Error Handling

- If `.agent-mux/config.yaml` has invalid YAML, show:
  ```
  [agent-mux] Error: config.yaml has invalid syntax
    Run `/mux-config reset` to restore defaults
  ```

- If the config file is missing and user runs `set`, create it from defaults first, then apply the change.

- If the user provides an unrecognized subcommand:
  ```
  [agent-mux] Unknown subcommand: {subcommand}
    Usage: /mux-config [set <key> <value> | reset]
  ```
