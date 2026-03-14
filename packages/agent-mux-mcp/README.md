# agent-mux

> Claude Code와 Codex CLI를 자동으로 오케스트레이션하는 AI 코딩 멀티플렉서

[![npm](https://img.shields.io/npm/v/agent-mux-mcp)](https://www.npmjs.com/package/agent-mux-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://github.com/wowoyong/agent-mux/actions/workflows/ci.yml/badge.svg)](https://github.com/wowoyong/agent-mux/actions)

[English](./README.en.md) | **한국어**

---

## 왜 agent-mux인가?

Claude Code와 Codex CLI 구독을 동시에 사용하고 있다면, 하나가 rate limit에 걸릴 때 나머지 하나는 놀고 있습니다.

agent-mux는 이 유휴 시간을 제거합니다. 작업을 분석해서 최적의 CLI로 자동 라우팅하고, rate limit에 걸리면 다른 쪽으로 전환합니다.

**$40/월(Pro+Plus)로 6시간 코딩 세션. agent-mux 없이는 90분이 한계.**

| | agent-mux 없이 | agent-mux 사용 |
|---|:---:|:---:|
| 사용 가능 시간 | ~1.5시간 | ~6시간 |
| 처리 태스크 | ~15건 | ~49건 |
| 비용/태스크 | $1.33 | $0.82 |

---

## 설치

### 방법 1: 독립 CLI (권장)

```bash
npm install -g agent-mux-mcp
mux setup
```

### 방법 2: Claude Code 플러그인

```bash
claude plugin marketplace add wowoyong/agent-mux
claude plugin install agent-mux
```

---

## 30초 Quick Start

```bash
# 1. 설치
npm install -g agent-mux-mcp

# 2. 설정 — Claude 구독 선택, Codex 구독 선택, 자동 티어 감지
mux setup

# 3. 대화형 모드 — REPL 진입, 작업 입력하면 자동 라우팅
mux

# 4. 원샷 모드
mux "write unit tests for auth module"
# → [agent-mux] Routing → CODEX (test writing, confidence: 92%)
# → Codex working... ✓ Complete — 3 files (34s)
```

---

## 사용 방법

### 대화형 모드 (REPL)

```bash
mux
```

인자 없이 `mux`를 실행하면 REPL에 진입합니다.

```
  ⚡ agent-mux v0.4.0 | standard tier ($120/mo)
  Claude ████████████░░░░░░░░ 12/225 | Codex ██░░░░░░░░░░░░░░░░░░ 3/200

  Type a task to route, or a command:
    /status  — budget dashboard
    /go      — auto-execute mode
    /config  — show configuration
    /help    — show help
    /quit    — exit

mux> write tests for auth module        ← 자동 라우팅
mux> /go JWT 인증 시스템 구축              ← 자동 분해 + 실행
mux> /status                             ← 예산 대시보드
mux> /config                             ← 설정 확인
mux> /quit                               ← 종료
```

REPL 안에서 일반 텍스트를 입력하면 자동으로 라우팅 + 실행되고, 매 실행 후 예산 바가 업데이트됩니다.

### 원샷 모드

```bash
# 자동 라우팅
mux "write unit tests for auth module"

# 라우팅 미리보기 (실행 안 함)
mux --dry-run "refactor the database module"

# 시그널 상세 분석
mux --verbose "fix the login bug"

# 강제 라우팅
mux --route=codex "generate API docs"
mux --route=claude "security audit"

# 예산 확인
mux status

# 설정
mux setup    # 초기 설정 마법사
mux config   # 현재 설정 JSON 출력
```

### mux go — "Just Do It" 커맨드

```bash
mux go "사용자 대시보드 구축 — 차트, 테이블, API 연동"
```

```
⚡ mux go — auto-routing + auto-execution

Decomposed into 4 subtasks (fan-out):

  ◆ [1] API 엔드포인트 설계      → CLAUDE
  ◆ [2] 차트 컴포넌트 구현       → CODEX
  ◆ [3] 테이블 컴포넌트 구현     → CODEX
  ◆ [4] API 연동 코드 작성       → CODEX

Phase 1: Claude tasks
  ◆ API 엔드포인트 설계
  Claude:
    ...

Phase 2: Codex tasks
  ◆ 차트 컴포넌트 구현... (42s, 2 files)
  ◆ 테이블 컴포넌트 구현... (38s, 2 files)
  ◆ API 연동 코드 작성... (25s, 1 files)

═══ Complete ═══
Budget: Claude 13/225 | Codex 6/200
```

`mux go`는 다음을 수행합니다:

1. **자동 분해** — 복잡한 작업을 독립적인 서브태스크로 분리 (번호 리스트, 불릿, "and"/"그리고" 기반 분할)
2. **라우팅 결정** — 각 서브태스크에 Claude(설계/분석) 또는 Codex(구현/테스트) 지정
3. **순차 실행** — Claude 태스크 먼저 실행한 후 Codex 태스크 실행
4. **자동 머지** — Codex 결과를 git worktree에서 자동으로 merge (확인 프롬프트 없음)
5. **에스컬레이션** — Codex 실패 시 자동으로 Claude에 에스컬레이션

분해가 불필요한 단순 작업은 단일 에이전트로 직접 실행됩니다.

---

## 라우팅 동작 원리

agent-mux는 **2-Phase 라우팅 엔진**을 사용합니다. Budget 티어에서 **100% 로컬 실행**으로 라우팅에 LLM 토큰을 소비하지 않습니다.

### Phase 1: Hard Rules (즉시 결정)

우선순위 기반으로 조건에 해당하면 즉시 라우팅합니다.

| 우선순위 | 조건 | 라우팅 | 근거 |
|:---:|------|--------|------|
| 1 | MCP 도구 필요 | Claude | MCP 접근은 Claude만 가능 |
| 2 | 대화형 상호작용 | Claude | 세션 내 대화가 필요 |
| 3 | 대화 컨텍스트 참조 | Claude | 이전 맥락은 Claude에만 존재 |
| 4 | 독립적 보안 감사 | Codex | 체계적 감사에 효율적 |
| 5 | 다수 파일 리팩토링 (>5) | Claude | 파일 간 조율이 필요 |
| 6 | 프로젝트 스캐폴딩 | Claude | 전체 아키텍처 이해 필요 |

### Phase 2: 가중치 기반 시그널 점수

Phase 1에서 매칭되지 않으면 20개 시그널의 가중치 점수를 계산합니다.

```
score = sum(signal_weight x signal_value) + sum(interaction_modifier)

score > 0  → Codex
score < 0  → Claude
score == 0 → budget_tiebreaker()
```

**Codex 방향 시그널 (양수):** 테스트 작성(+40), 자체 완결 태스크(+35), 보안 감사(+30), 문서 생성(+30), 코드 리뷰(+25), 리팩토링(+20), 디버깅(+15), 터미널 태스크(+10)

**Claude 방향 시그널 (음수):** MCP 필요(-100), 대화 컨텍스트(-100), 대화형(-100), 스캐폴딩(-100), 아키텍처 설계(-40), 다중 파일 조율(-35), 프로젝트 컨텍스트(-30), 프론트엔드(-20)

**인터랙션 모디파이어:**
- 프로젝트 컨텍스트가 필요한 리팩토링 → Claude 쪽으로 -40
- 자체 완결 + 검증 가능한 디버깅 → Codex 쪽으로 +30
- 다중 파일 테스트 작성 → Claude 쪽으로 -20
- 보안 리뷰 + 코드 리뷰 → Codex 쪽으로 +20
- 복잡 + 긴급 → Claude 쪽으로 -25

### 예산 압박 보정

Claude 예산이 20% 이하로 떨어지면 Codex 쪽으로 +50점 보정, Codex가 20% 이하면 Claude 쪽으로 -50점 보정합니다.

### 학습된 오버라이드

사용자가 수동으로 라우팅을 변경하면 이를 학습하여 이후 유사 작업에 자동 적용합니다 (30초 캐시 TTL).

### 라우팅 예시

```
mux "유닛 테스트 작성해줘"
→ [agent-mux] Routing → CODEX (test writing, confidence: 92%)

mux "결제 시스템 아키텍처 설계해줘"
→ [agent-mux] Routing → CLAUDE (architectural design, confidence: 95%)

mux "이 JWT 에러 디버깅해줘"
→ [agent-mux] Routing → CLAUDE (debugging, context needed, confidence: 78%)

mux "JSDoc 추가해줘"
→ [agent-mux] Routing → CODEX (doc generation, confidence: 88%)
```

---

## 지원 티어

| Tier | Claude | Codex | 월 비용 | 라우팅 비율 | 엔진 | 바이어스 | 핵심 가치 |
|------|--------|-------|:---:|:---:|:---:|:---:|-----------|
| **Budget** | Pro $20 | Plus $20 | $40 | 30:70 | local | codex | 4x 코딩 시간 |
| **Standard** | Max 5x $100 | Plus $20 | $120 | 55:45 | local | balanced | 병렬 워크플로우 |
| **Premium** | Max 20x $200 | Plus $20 | $220 | 70:30 | hybrid | claude | 핸즈프리 라우팅 |
| **Power** | Max 20x $200 | Pro $200 | $400 | 65:35 | hybrid | adaptive | 최대 병렬성 |

### 티어별 Rate Limit

| Tier | Claude (5시간당) | Codex (일일) | 동시 실행 |
|------|:---:|:---:|:---:|
| Budget | 45 | 200 | 1 |
| Standard | 225 | 200 | 1 |
| Premium | 900 | 200 | 1 |
| Power | 900 | 무제한 | 3 |

### 에스컬레이션 전략

| Tier | 전략 | 최대 재시도 |
|------|------|:---:|
| Budget | fix (패치만 시도) | 1 |
| Standard | fix_then_redo (패치 → 재실행) | 2 |
| Premium | fix_then_redo | 2 |
| Power | full (패치 → 재실행 → Claude 완전 위임) | 3 |

---

## 기능 매트릭스

| Feature | Budget $40 | Standard $120 | Premium $220 | Power $400 |
|---------|:---:|:---:|:---:|:---:|
| Local routing engine | O | O | O | O |
| LLM-assisted routing | - | 선택 | 상시 | 상시 |
| 전체 CLI 명령어 | O | O | O | O |
| Override flags | O | O | O | O |
| Batch mode | 30s | 15s | 5s | 3s |
| Parallel dispatch | - | O | O | O |
| Auto-escalation | 1회 | 2회 | 2회 | 3회 |
| Task decomposition (`mux go`) | O | O | O | O |
| Concurrent Codex | 1 | 1 | 1 | 3 |
| Conservation mode | ON | - | - | - |

---

## 플래그 레퍼런스

| 플래그 | 기본값 | 설명 |
|--------|--------|------|
| `--dry-run` | OFF | 라우팅 결정만 표시, 실행 안 함 |
| `--verbose` | OFF | 활성 시그널 상세 분석 표시 |
| `--route=claude\|codex` | auto | 강제 라우팅 (confidence 100%) |
| `--auto-apply` | OFF | Codex 결과 확인 없이 자동 적용 |
| `--confirm` | ON (Codex) | Codex 결과 diff 확인 후 적용 |

---

## Codex 실행 파이프라인

Codex 작업은 안전하게 격리 실행됩니다.

```
PREPARE → SPAWN → MONITOR → VALIDATE → INTEGRATE
```

1. **PREPARE** — Git worktree 생성, 메인 작업 디렉토리와 완전 분리
2. **SPAWN** — `codex exec --full-auto --json --ephemeral`로 실행
3. **MONITOR** — JSONL event stream 실시간 파싱, 90초 stall 감지 (타임아웃: 420초)
4. **VALIDATE** — 4-Stage 검증
   - Stage 1: 파일 범위 검사 (deny-list 위반 체크)
   - Stage 2: 테스트/린트 실행
   - Stage 3: Claude 리뷰
   - Stage 4: 사용자 확인 (`--auto-apply` 시 스킵)
5. **INTEGRATE** — 승인 시 `git merge --no-ff`로 merge, 거부 시 worktree 삭제 + 브랜치 롤백

### Diff 미리보기

Codex 결과는 컬러 diff로 미리보기됩니다 (최대 50줄 프리뷰, `d` 입력 시 전체 diff 표시). 사용자는 `y`(적용), `n`(폐기), `d`(전체 diff) 중 선택할 수 있습니다.

### 파일 보호 (Deny-list)

다음 파일은 Codex가 수정할 수 없습니다 (자동 차단):

```
.github/workflows/*    .env*          *.pem         *.key
*.p12                  *.jks          package.json  package-lock.json
yarn.lock              pnpm-lock.yaml Gemfile.lock  poetry.lock
go.sum                 Cargo.lock     Dockerfile    docker-compose*.yml
Makefile               .npmrc         .pypirc       Jenkinsfile
```

커스텀 패턴은 설정 파일의 `deny_list`에 추가할 수 있습니다.

### 재시도 + 에스컬레이션

Codex가 실패하면 설정된 전략에 따라 자동 재시도하고, 최대 재시도 횟수 초과 시 Claude에 에스컬레이션합니다. 에스컬레이션 시 실패 원인이 Claude에 전달됩니다.

---

## 예산 추적

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

### 경고 시스템

설정 파일의 `budget.warnings` 배열로 경고 임계값을 지정합니다 (기본: 50%, 75%, 90%).

- **50%**: 정보 알림
- **75%**: 경고 — 라우팅 바이어스 자동 조정
- **90%**: 위험 — 소진된 에이전트 회피 모드

### 소진 대응

| 상황 | 기본 동작 |
|------|-----------|
| Claude 소진 | `codex_only` — Codex만 사용 |
| 양쪽 소진 | `queue_and_wait` — 대기열에 저장 |

---

## 설정

### 설정 마법사

```bash
mux setup
```

대화형 위저드가 Claude 구독과 Codex 구독을 선택받고, 자동으로 티어를 결정하여 `.agent-mux/config.yaml`에 저장합니다.

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

### 설정 파일

설정 파일 위치: `.agent-mux/config.yaml` (프로젝트) 또는 `~/.agent-mux/config.yaml` (글로벌)

```yaml
# .mux-config.yaml (Budget 티어 기본값)
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

# Optional: 커스텀 deny-list 패턴 (기본값에 추가됨)
# deny_list:
#   - "*.secret"
#   - "internal/**"
```

---

## Claude Code 플러그인 모드

독립 CLI 외에 Claude Code 플러그인으로도 사용할 수 있습니다:

```bash
claude plugin marketplace add wowoyong/agent-mux
claude plugin install agent-mux
# Claude Code 재시작 후
/mux "write tests"
/mux-setup
/mux-status
```

| 플러그인 명령어 | 설명 |
|----------------|------|
| `/mux "작업"` | 작업 라우팅 및 실행 |
| `/mux-status` | 예산 및 작업 현황 |
| `/mux-config` | 설정 조회/변경 |
| `/mux-setup` | 초기 설정 마법사 |

---

## CLI 명령어 요약

| 명령어 | 설명 |
|--------|------|
| `mux` | REPL 대화형 모드 진입 |
| `mux "<작업>"` | 자동 라우팅 + 실행 |
| `mux go "<작업>"` | 자동 분해 + 라우팅 + 실행 |
| `mux status` | 예산 및 상태 대시보드 |
| `mux setup` | 초기 설정 마법사 |
| `mux config` | 현재 설정 JSON 출력 |

---

## Works Great With

agent-mux는 **단독으로 완벽히 동작**합니다. 다음 플러그인들과 함께 사용하면 더욱 강력합니다:

- **[harness-planner](https://github.com/wowoyong/claude-plugin-harness-planner)** — 복잡한 작업을 자동 분해하여 mux-ready 서브태스크로 변환
- **[architecture-enforcer](https://github.com/wowoyong/claude-plugin-architecture-enforcer)** — Codex 스폰 시 아키텍처 규칙을 자동 주입하여 일관성 보장
- **[harness-docs](https://github.com/wowoyong/claude-plugin-harness-docs)** — AGENTS.md 기반 프로젝트 컨텍스트로 라우팅 정확도 향상

이 플러그인들은 세션 시작 시 자동으로 감지되며, 감지 실패 시에도 agent-mux 핵심 기능에 영향을 주지 않습니다.

---

## 아키텍처

agent-mux는 두 개의 독립 컴포넌트로 구성됩니다:

| 컴포넌트 | 형태 | 역할 |
|----------|------|------|
| **Claude Code Plugin** | Markdown (skills, commands, agents, hooks) | 사용자 인터페이스, 라우팅 판단, 결과 리뷰 |
| **MCP Server** (`agent-mux-mcp`) | TypeScript | Codex 프로세스 생성, 예산 추적, 상태 관리 |

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

## 기술 스택

- **TypeScript** — 전체 코어 + MCP 서버
- **MCP (Model Context Protocol)** — Claude Code 플러그인 통합
- **Commander.js** — CLI 프레임워크
- **Chalk + Ora** — 터미널 UI (컬러 출력, 스피너)
- **Vitest** — 유닛 테스트

---

## 설계 철학

[OpenAI Harness Engineering](https://openai.com)과 oh-my-openagent에서 영감을 받았습니다.

- **"Humans steer, agents execute"** — 개발자는 방향을 정하고, agent가 실행한다
- **Zero-overhead routing** — Budget 티어에서 라우팅에 0 토큰 소비. 키워드 매칭만으로 20개 시그널 추출
- **Repository as source of truth** — 모든 Codex 작업은 git worktree로 격리, merge 또는 rollback으로 깔끔한 이력 유지
- **Subscription Efficiency Maximizer** — 구독 비용 대비 최대 생산성. Rate limit의 유휴 시간을 제거

---

## 라이선스

[MIT](LICENSE)

---

## 기여

Issues와 PRs를 환영합니다!

https://github.com/wowoyong/agent-mux/issues
