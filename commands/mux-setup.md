---
name: mux-setup
description: Interactive tier setup wizard for agent-mux
allowed-tools: [Bash, Read, Write, Edit, get_mux_status, check_budget]
---

# /mux-setup — agent-mux 초기 설정 마법사

이 커맨드는 사용자의 Claude + Codex 구독 조합을 파악하여 최적의 라우팅 설정을 자동 생성하는 대화형 마법사입니다.

---

## Step 1: 환경 확인

MCP 도구 `get_mux_status`를 호출하여 현재 상태를 확인합니다. 호출이 실패하면 Bash로 직접 확인합니다.

```bash
command -v codex && codex --version 2>&1
```

확인 결과를 아래 형식으로 표시합니다:

```
[agent-mux] ═══ Agent Mux Setup Wizard ═══

  환경 확인 중...

  ✓ Codex CLI: installed (v{version})
  ✓ Node.js:   {node_version}
  ✓ agent-mux MCP: ready
```

**Codex CLI가 설치되지 않은 경우:**

```
[agent-mux] ═══ Agent Mux Setup Wizard ═══

  환경 확인 중...

  ✗ Codex CLI: not installed
  ✓ Node.js:   {node_version}

  ─────────────────────────────
  Codex CLI가 필요합니다.
  설치: npm install -g @openai/codex
  설치 후 /mux-setup 을 다시 실행하세요.
  ─────────────────────────────
```

Codex CLI가 없으면 여기서 중단합니다. 사용자가 설치 후 다시 실행하도록 안내합니다.

---

## Step 2: Claude 구독 선택

아래 메시지를 표시하고 사용자의 입력을 기다립니다:

```
[1/4] Claude Code 구독 플랜을 선택해주세요:

  1) Pro      $20/mo   — ~45 messages / 5hr window
     → 기본 플랜. 메시지 절약이 핵심.

  2) Max 5x   $100/mo  — ~225 messages / 5hr window
     → 중간 용량. Claude와 Codex 균형 사용 가능.

  3) Max 20x  $200/mo  — ~900 messages / 5hr window
     → 대용량. Claude 중심 라우팅 + Codex 보조.

  선택 (1/2/3):
```

사용자가 1, 2, 3 중 하나를 입력할 때까지 기다립니다. 유효하지 않은 입력이면 다시 물어봅니다.

---

## Step 3: Codex 구독 선택

아래 메시지를 표시하고 사용자의 입력을 기다립니다:

```
[2/4] Codex CLI 구독 플랜을 선택해주세요:

  1) Plus     $20/mo   — ~200 tasks/day, 1 concurrent, 10min timeout
     → 기본 플랜. 순차 실행.

  2) Pro      $200/mo  — unlimited tasks, 3 concurrent, 30min timeout
     → 파워 플랜. 병렬 실행 + 무제한 태스크.

  선택 (1/2):
```

사용자가 1 또는 2를 입력할 때까지 기다립니다.

---

## Step 4: 티어 결정 + 요약

사용자의 구독 조합을 아래 매핑 표에 따라 티어로 변환합니다:

| Claude Plan | Codex Plan | Tier     | Monthly Cost | 설명                              |
|-------------|------------|----------|-------------|-----------------------------------|
| Pro $20     | Plus $20   | budget   | $40/mo      | 최소 비용. Codex 우선, Claude 절약 |
| Max 5x $100 | Plus $20  | standard | $120/mo     | 균형 라우팅. 병렬 디스패치         |
| Max 20x $200| Plus $20  | premium  | $220/mo     | Claude 중심. 태스크 분해 활성화    |
| Max 20x $200| Pro $200  | power    | $400/mo     | 풀 오케스트레이션. 파이프라인 모드  |
| Pro $20     | Pro $200   | budget   | $220/mo     | budget 라우팅 + power Codex        |
| Max 5x $100 | Pro $200  | standard | $300/mo     | standard 라우팅 + power Codex      |

결정된 티어를 아래 형식으로 표시합니다:

```
[3/4] 티어 결정: {tier_name} (${cost}/mo)

  ┌─────────────────────────────────────────────┐
  │ Routing Strategy                             │
  ├─────────────────────────────────────────────┤
  │ Engine:            {local|hybrid}            │
  │ Bias:              {codex|balanced|claude|adaptive} │
  │ Split:             Claude {pct}% / Codex {pct}%    │
  │ Escalation:        {strategy} (max {n} retries)    │
  ├─────────────────────────────────────────────┤
  │ Features                                     │
  ├─────────────────────────────────────────────┤
  │ Batch mode:        {ON|OFF}                  │
  │ Conservation mode: {ON|OFF}                  │
  │ Parallel dispatch: {ON|OFF}                  │
  │ Task decomposition:{ON|OFF}                  │
  │ Pipeline mode:     {ON|OFF}                  │
  │ Concurrent Codex:  {1|3}                     │
  ├─────────────────────────────────────────────┤
  │ Budget Limits                                │
  ├─────────────────────────────────────────────┤
  │ Claude:            {n} msgs / 5hr            │
  │ Codex:             {n|unlimited} tasks / day │
  │ Alerts at:         {thresholds}%             │
  └─────────────────────────────────────────────┘
```

**각 티어별 표시 값:**

### budget 티어
- Engine: local
- Bias: codex
- Split: Claude 30% / Codex 70%
- Escalation: fix (max 1 retries)
- Batch mode: ON
- Conservation mode: ON
- Parallel dispatch: OFF
- Task decomposition: OFF
- Pipeline mode: OFF
- Concurrent Codex: 1
- Claude: 45 msgs / 5hr
- Codex: 200 tasks / day
- Alerts at: 50%, 75%, 90%

### standard 티어
- Engine: local (LLM-assist optional)
- Bias: balanced
- Split: Claude 55% / Codex 45%
- Escalation: fix (max 2 retries)
- Batch mode: OFF
- Conservation mode: OFF
- Parallel dispatch: ON
- Task decomposition: OFF
- Pipeline mode: OFF
- Concurrent Codex: 1
- Claude: 225 msgs / 5hr
- Codex: 200 tasks / day
- Alerts at: 75%, 90%

### premium 티어
- Engine: hybrid (LLM-assist always)
- Bias: claude
- Split: Claude 70% / Codex 30%
- Escalation: fix_then_redo (max 3 retries)
- Batch mode: OFF
- Conservation mode: OFF
- Parallel dispatch: ON
- Task decomposition: ON
- Pipeline mode: OFF
- Concurrent Codex: 1
- Claude: 900 msgs / 5hr
- Codex: 200 tasks / day
- Alerts at: 75%, 90%

### power 티어
- Engine: hybrid (full orchestration)
- Bias: adaptive
- Split: (dynamic, real-time budget 기반)
- Escalation: full (unlimited retries)
- Batch mode: OFF
- Conservation mode: OFF
- Parallel dispatch: ON
- Task decomposition: ON
- Pipeline mode: ON
- Concurrent Codex: 3
- Claude: 900 msgs / 5hr
- Codex: unlimited tasks / day
- Alerts at: 90%

표시 후 확인을 요청합니다:

```
이 설정으로 진행할까요? (Y/n):
```

사용자가 `n` 또는 `N`을 입력하면 Step 2로 돌아갑니다. `Y`, `y`, 또는 Enter를 입력하면 Step 5로 진행합니다.

---

## Step 5: 설정 파일 저장

프로젝트 루트에 `.agent-mux/` 디렉토리를 생성하고 `config.yaml` 파일을 저장합니다.

```bash
mkdir -p .agent-mux
```

티어에 따라 아래 YAML 중 해당하는 것을 `.agent-mux/config.yaml`에 저장합니다.

### budget 티어 ($40/mo) — Pro + Plus

```yaml
# agent-mux configuration
# Generated by /mux-setup wizard
# Tier: budget ($40/mo) — Claude Pro + Codex Plus

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

features:
  parallel_dispatch: false
  task_decomposition: false
  pipeline_mode: false

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

### standard 티어 ($120/mo) — Max 5x + Plus

```yaml
# agent-mux configuration
# Generated by /mux-setup wizard
# Tier: standard ($120/mo) — Claude Max 5x + Codex Plus

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

batch_mode:
  enabled: false

conservation:
  enabled: false
  codex_first_on_uncertain: false

features:
  parallel_dispatch: true
  task_decomposition: false
  pipeline_mode: false

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

### premium 티어 ($220/mo) — Max 20x + Plus

```yaml
# agent-mux configuration
# Generated by /mux-setup wizard
# Tier: premium ($220/mo) — Claude Max 20x + Codex Plus

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

batch_mode:
  enabled: false

conservation:
  enabled: false
  codex_first_on_uncertain: false

features:
  parallel_dispatch: true
  task_decomposition: true
  context_pre_gathering: true
  pipeline_mode: false

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

### power 티어 ($400/mo) — Max 20x + Pro

```yaml
# agent-mux configuration
# Generated by /mux-setup wizard
# Tier: power ($400/mo) — Claude Max 20x + Codex Pro

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

batch_mode:
  enabled: false

conservation:
  enabled: false
  codex_first_on_uncertain: false

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

### Codex Pro를 선택했지만 Claude가 Pro/Max5x인 경우

Codex Pro 선택 시 `codex_plan: pro`로 설정하되 라우팅 티어(budget/standard)는 Claude 플랜에 따라 결정합니다. 추가로 Codex Pro의 이점을 반영합니다:

```yaml
# budget + Codex Pro인 경우, budget 템플릿에서 아래만 변경:
codex_plan: pro
budget:
  codex_tasks_per_day: unlimited
  max_concurrent_codex: 3

# standard + Codex Pro인 경우, standard 템플릿에서 아래만 변경:
codex_plan: pro
budget:
  codex_tasks_per_day: unlimited
  max_concurrent_codex: 3
features:
  max_concurrent_codex: 3
```

저장 후 표시:

```
[agent-mux] 설정 파일 저장됨: .agent-mux/config.yaml
```

---

## Step 6: 완료 + 사용법 안내

설정 완료 메시지를 표시합니다:

```
[4/4] Setup complete!

  ═══════════════════════════════════════════
  agent-mux 설정이 완료되었습니다.
  ═══════════════════════════════════════════

  Tier:   {tier_name} (${cost}/mo)
  Config: .agent-mux/config.yaml

  ─── 사용법 ───────────────────────────────

  /mux "write unit tests for auth module"
    → 태스크를 분석하여 Claude 또는 Codex로 자동 라우팅

  /mux "design payment system architecture"
    → 아키텍처 설계는 Claude로 라우팅

  /mux --dry-run "fix lint errors"
    → 라우팅 결정만 확인 (실행하지 않음)

  /mux --route=codex "add JSDoc comments"
    → Codex로 강제 라우팅

  /mux-status
    → 현재 예산 사용량 및 태스크 상태 확인

  /mux-config
    → 설정 확인 및 수정

  ─── 팁 ─────────────────────────────────

  • Codex에 라우팅된 태스크는 격리된 worktree에서 실행됩니다.
  • 결과 diff를 확인 후 승인해야 메인 브랜치에 반영됩니다.
  • deny_list 파일은 --auto-apply 모드에서도 항상 승인이 필요합니다.
  • /mux-config 로 split 비율, bias 등을 언제든 조정할 수 있습니다.

  ═══════════════════════════════════════════
```

### 동반 플러그인 감지

설정 완료 후 동반 플러그인을 검색합니다:

```bash
for plugin in harness-planner architecture-enforcer harness-docs; do
  if ls "$HOME/.claude/plugins/cache/wowoyong/$plugin" 2>/dev/null; then
    echo "found:$plugin"
  fi
done
```

감지된 플러그인이 있으면 표시합니다:

```
[agent-mux] 동반 플러그인 감지됨:
  • architecture-enforcer — Codex 프롬프트에 아키텍처 룰 자동 주입
  • harness-planner       — Plan 기반 태스크 분해 라우팅
  • harness-docs          — AGENTS.md 컨텍스트로 라우팅 정확도 향상

  라우팅 시 자동으로 통합됩니다.
```

감지된 플러그인이 없으면:

```
[agent-mux] 추천 동반 플러그인:
  • architecture-enforcer — 아키텍처 룰 강제 + Codex 프롬프트 강화
    설치: claude plugin add wowoyong/architecture-enforcer
```
