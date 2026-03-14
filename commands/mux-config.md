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

## Steps

### Show current config (`/mux-config`)

1. Read `.agent-mux/config.yaml` from the project root
2. If the file does not exist, show default configuration for the detected tier
3. Display the configuration in a readable format:

```
[agent-mux] ═══ Configuration ═══
  Config file: {path}

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
    batch_mode:          {on|off} (queue: {n}s)
    conservation_mode:   {on|off}
    parallel_dispatch:   {on|off}
    task_decomposition:  {on|off}

  Budget Warnings: {thresholds}

  Deny List:
    {deny_list_entries}
═══════════════════════════════
```

### Set a value (`/mux-config set <key> <value>`)

1. Parse the dotted key path (e.g., `routing.bias`, `budget.warnings`, `features.batch_mode`)
2. Validate the value against allowed options:

| Key | Allowed Values |
|-----|---------------|
| `routing.engine` | `local`, `hybrid` |
| `routing.bias` | `codex`, `balanced`, `claude`, `adaptive` |
| `routing.split.claude` | 0-100 (integer) |
| `routing.split.codex` | 0-100 (integer, must sum to 100 with claude) |
| `escalation.enabled` | `true`, `false` |
| `escalation.strategy` | `fix`, `fix_then_redo`, `full` |
| `escalation.max_retries` | 0-10 (integer) |
| `features.batch_mode` | `true`, `false` |
| `features.conservation_mode` | `true`, `false` |
| `features.parallel_dispatch` | `true`, `false` |
| `features.task_decomposition` | `true`, `false` |
| `budget.warnings` | comma-separated integers (e.g., `50,75,90`) |

3. Update the value in `.agent-mux/config.yaml`
4. Confirm the change:
```
[agent-mux] Updated: {key} = {value}
```

### Reset to defaults (`/mux-config reset`)

1. Detect the current tier from the existing config
2. Overwrite `.agent-mux/config.yaml` with tier defaults:
   - Budget: local engine, codex bias, 30/70 split, conservation ON
   - Standard: local engine, balanced bias, 55/45 split, parallel dispatch ON
   - Premium: hybrid engine, claude bias, 70/30 split, task decomposition ON
   - Power: hybrid engine, adaptive bias, dynamic split, pipeline mode ON
3. Confirm:
```
[agent-mux] Configuration reset to {tier} tier defaults
```

## Config file location

The config file is located at `.agent-mux/config.yaml` relative to the project root. If the directory does not exist, create it when writing config.

## Default config template (Budget tier)

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
