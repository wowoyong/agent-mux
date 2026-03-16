# agent-mux TODO

> Last updated: 2026-03-16
> Current version: v0.8.0

---

## Critical — ALL DONE ✓

## High Priority — ALL DONE ✓

## Medium Priority — ALL DONE ✓

## Low Priority — 대부분 완료

- [x] **`mux watch`** — `fs.watch` 기반 파일 변경 감시 + 자동 재실행.
- [x] **Export usage stats** — `mux export --format=csv|json --days=N`.
- [x] **Multi-model support** — 복잡도별 sonnet/opus 선택.
- [x] **Parallel Codex dispatch** — Power 티어 `Promise.allSettled` 배치 병렬 실행.
- [x] **Conservation mode** — `conservation.codexFirstOnUncertain` tiebreaker 연동.
- [x] **`mux undo`** — 마지막 `mux:` 머지 커밋 자동 감지 + `git revert`.
- [x] **Batch mode** — **완료** (v0.8.0): `mux batch` 명령어로 여러 태스크 입력 후 순차 실행. 타임아웃 지원.
- [x] **LLM-assisted routing (hybrid engine)** — **완료** (v0.8.0): `routing.engine: hybrid` 시 로컬 점수 불확실하면 Claude에 분류 요청. `routeTaskHybrid()` + `llmAssistRoute()`.
- [x] **Plugin ecosystem** — **완료** (v0.8.0): `cli/plugins.ts`에 플러그인 감지 시스템. `detectPlugins()`, `getPluginContext()` (AGENTS.md 지원). `mux status`에 플러그인 상태 표시.
- [ ] **Interactive TUI** — 패널 기반 터미널 UI (v2.0, 별도 패키지 필요).
- [ ] **Remote/team budget sharing** — 팀원 간 예산 추적 공유 (서버 필요, v2.0).

## Technical Debt — ALL DONE ✓

---

## Ideas / Exploration

- [x] **Cost-per-task tracking** — **완료** (v0.8.0): `--verbose` 모드에서 `estimateCost()` 결과 표시 (예상 비용 %, 요인).
- [x] **MCP server health check** — **완료** (v0.8.0): `health_check` 도구 등록 (status, version, uptime, budget).
- [ ] Routing confidence threshold tuning
- [ ] User override learning effectiveness
- [ ] Streaming Claude output with Markdown rendering
- [ ] Competitive positioning: killer demo
- [ ] Piped input mode documentation
- [ ] Web dashboard
- [ ] Decomposer 정확도 개선
