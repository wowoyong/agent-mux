# agent-mux

> Claude Code와 Codex CLI 사이에서 작업을 지능적으로 라우팅하는 Claude Code 플러그인

[![npm](https://img.shields.io/npm/v/agent-mux-mcp)](https://www.npmjs.com/package/agent-mux-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](./README.en.md) | **한국어**

---

## 30초 Quick Start

```bash
# 1. 설치
claude plugin add wowoyong/agent-mux

# 2. 설정
/mux-setup

# 3. 사용
/mux "유닛 테스트 작성해줘"
→ Codex: test writing, confidence: 92%
```

---

## 왜 agent-mux인가?

Claude Code와 Codex CLI는 각각 **독립적인 rate limit**을 가집니다. 하나가 한계에 도달하면 개발자는 대기해야 합니다. agent-mux는 이 유휴 시간을 제거합니다.

**$40/월(Pro + Plus)로 6시간 코딩 세션.** agent-mux 없이는 90분이 한계.

| | agent-mux 없이 | agent-mux 사용 |
|---|---|---|
| 사용 가능 시간 | ~1.5시간 | ~6시간 |
| 처리 태스크 | ~15건 | ~49건 |
| 추가 비용 | $0 | +$20 (Codex) |
| 비용/태스크 | $1.33 | $0.82 |

---

## 지원 티어

| Tier | Claude | Codex | 월 비용 | 핵심 가치 |
|------|--------|-------|---------|-----------|
| **Budget** | Pro $20 | Plus $20 | **$40** | 4x 코딩 시간 |
| **Standard** | Max 5x $100 | Plus $20 | **$120** | 병렬 워크플로우 |
| **Premium** | Max 20x $200 | Plus $20 | **$220** | 핸즈프리 라우팅 |
| **Power** | Max 20x $200 | Pro $200 | **$400** | 최대 병렬성 |

---

## 라우팅 동작 원리

agent-mux는 **2-Phase 라우팅 엔진**으로 작업을 최적의 CLI에 배정합니다.

### Phase 1: Hard Rules (즉시 결정)

MCP 도구 접근, 대화형 상호작용, 프로젝트 스캐폴딩 등 명확한 조건은 즉시 라우팅합니다.

| 조건 | 결정 | 근거 |
|------|------|------|
| MCP 도구 필요 | Claude | MCP 접근은 Claude Code만 가능 |
| 대화형 상호작용 | Claude | 세션 내 대화가 필요 |
| 대화 컨텍스트 필요 | Claude | 이전 맥락은 Claude에만 존재 |
| 단일 파일 보안 감사 | Codex | 체계적 감사에 효율적 |
| 다수 파일 리팩토링 | Claude | 프로젝트 맥락이 필요 |
| 프로젝트 스캐폴딩 | Claude | 전체 아키텍처 이해 필요 |

### Phase 2: Weighted Scoring (점수 기반)

Phase 1에서 매칭되지 않으면, 20개 시그널의 가중치 점수를 계산합니다.

```
score = sum(signal_weight x signal_value) + sum(interaction_modifier)

score > 0  → Codex
score < 0  → Claude
score == 0 → budget_tiebreaker()
```

### 라우팅 예시

```
/mux "유닛 테스트 작성해줘"
→ Codex: test writing, confidence: 92%

/mux "결제 시스템 아키텍처 설계해줘"
→ Claude: architectural design, confidence: 95%

/mux "이 JWT 에러 디버깅해줘"
→ Claude: debugging (context needed), confidence: 78%

/mux "JSDoc 추가해줘"
→ Codex: doc generation, confidence: 88%
```

Budget 티어에서는 **100% 로컬 실행**으로 라우팅에 LLM 토큰을 소비하지 않습니다.

---

## 명령어

| 명령어 | 설명 |
|--------|------|
| `/mux "작업"` | 작업 라우팅 및 실행 |
| `/mux-status` | 예산 및 작업 현황 |
| `/mux-config` | 설정 조회/변경 |
| `/mux-setup` | 초기 설정 마법사 |

---

## 플래그

| 플래그 | 기본값 | 설명 |
|--------|--------|------|
| `--confirm` | ON (Codex) | Diff 확인 후 적용 |
| `--auto-apply` | OFF | 확인 생략 (deny-list 파일은 항상 승인 필요) |
| `--dry-run` | OFF | 라우팅 결정만 표시, 실행 안 함 |
| `--verbose` | OFF | 시그널 상세 분석 |
| `--route=claude\|codex` | auto | 강제 라우팅 |

---

## Works Great With

agent-mux는 **단독으로 완벽히 동작**합니다. 하지만 다음 플러그인들과 함께 사용하면 더욱 강력합니다:

- **[harness-planner](https://github.com/wowoyong/claude-plugin-harness-planner)** — 복잡한 작업을 자동 분해하여 mux-ready 서브태스크로 변환
- **[architecture-enforcer](https://github.com/wowoyong/claude-plugin-architecture-enforcer)** — Codex 스폰 시 아키텍처 규칙을 자동 주입하여 일관성 보장
- **[harness-docs](https://github.com/wowoyong/claude-plugin-harness-docs)** — AGENTS.md 기반 프로젝트 컨텍스트로 라우팅 정확도 향상

이 플러그인들은 세션 시작 시 자동으로 감지되며, 감지 실패 시에도 agent-mux 핵심 기능에 영향을 주지 않습니다.

---

## 설정

프로젝트 루트에 `.mux-config.yaml`을 생성하거나, `/mux-setup` 위저드를 실행하세요.

```yaml
# .mux-config.yaml (Budget 티어 기본값)
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

전체 설정 예시는 [`.mux-config.yaml.example`](./.mux-config.yaml.example)을 참고하세요.

---

## 기능 매트릭스

| Feature | Budget $40 | Standard $120 | Premium $220 | Power $400 |
|---------|:---:|:---:|:---:|:---:|
| Local routing engine | O | O | O | O |
| LLM-assisted routing | - | 선택 | 상시 | 상시 |
| `/mux` 전체 명령어 | O | O | O | O |
| Override flags | O | O | O | O |
| Batch mode | 30s | 15s | 5s | 3s |
| Parallel dispatch | - | O | O | O |
| Auto-escalation | 1회 | 2회 | 3회 | 무제한 |
| Task decomposition | - | - | O | N-way |
| Concurrent Codex | 1 | 1 | 1 | 3 |
| Conservation mode | ON | - | - | - |
| Pipeline orchestration | - | - | - | fan-out/in |

---

## Codex 실행 파이프라인

Codex 작업은 **5-Stage 파이프라인**으로 실행됩니다:

```
PREPARE → SPAWN → MONITOR → VALIDATE → INTEGRATE
```

1. **PREPARE** — git worktree 생성, prompt + context 구성
2. **SPAWN** — Codex CLI full-auto 모드로 실행
3. **MONITOR** — JSONL event stream 실시간 파싱, 90초 stall 감지
4. **VALIDATE** — 4-Stage 검증 (file scope / tests,lint / Claude review / user confirm)
5. **INTEGRATE** — worktree 브랜치 merge 또는 rollback

---

## 보안

- Codex는 **git worktree에서 격리 실행** (network 비활성화, .git 읽기 전용)
- **민감 파일 자동 보호** (deny-list): `.github/workflows/*`, `.env*`, `*.pem`, `*.key`, dependency manifests
- **의존성 파일 수정 시** `--auto-apply`와 무관하게 항상 사용자 명시적 승인 필요
- Codex CLI 버전 고정으로 안정성 보장

---

## 아키텍처

agent-mux는 두 개의 독립 컴포넌트로 구성됩니다:

| 컴포넌트 | 형태 | 역할 |
|----------|------|------|
| **Claude Code Plugin** | Markdown (skills, commands, agents, hooks) | 사용자 인터페이스, 라우팅 판단, 결과 리뷰 |
| **MCP Server** (`agent-mux-mcp`) | TypeScript | Codex 프로세스 생성, 예산 추적, 상태 관리 |

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

## 설계 철학

[OpenAI Harness Engineering](https://openai.com)과 oh-my-openagent에서 영감을 받았습니다.

- **"Humans steer, agents execute"** — 개발자는 방향을 정하고, agent가 실행한다
- **Repository as source of truth** — 모든 작업 결과는 git worktree를 통해 리포지토리에 기록
- **Zero-overhead routing** — Budget 티어에서 라우팅에 0 토큰 소비

---

## 라이선스

[MIT](LICENSE)
