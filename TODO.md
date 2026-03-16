# agent-mux TODO

> Last updated: 2026-03-16
> Current version: v0.7.0

---

## Critical — ALL DONE ✓

- [x] Non-git-repo crash
- [x] Version string hardcoded in 3 places
- [x] No graceful shutdown / Ctrl+C handling
- [x] No unhandledRejection / uncaughtException handler
- [x] General conversation routing
- [x] REPL arrow-key / history navigation broken
- [x] `config set` command does nothing
- [x] Claude CLI not found gives cryptic error
- [x] Codex CLI not found gives no guidance
- [x] MCP 서버 버전 하드코딩

---

## High Priority — ALL DONE ✓

- [x] General chat mode (`/chat`)
- [x] Task history (`/history`)
- [x] Korean language routing support (v0.7.0: `\b` 워드 바운더리 버그 수정)
- [x] Worktree cleanup on abnormal exit
- [x] Progress feedback during Codex execution
- [x] Timeout values hardcoded
- [x] `mux init` command
- [x] Config validation (v0.7.0: `validateEnum()`/`validateNumber()` + 테스트 12개)
- [x] `askUser()` readline singleton (v0.7.0)

---

## Medium Priority — ALL DONE ✓

- [x] REPL prompt colorization
- [x] Tab completion in REPL
- [x] `--debug` / `--log-level` flag
- [x] File/directory context passing
- [x] Cancel running task gracefully (v0.7.0)
- [x] Session resume
- [x] Auto-update notification
- [x] Colored diff output width adaptation
- [x] `/go` without argument shows no error
- [x] REPL help text doesn't explain `/go`
- [x] Empty input handling in REPL
- [x] `/why` command

---

## Low Priority — 대부분 완료

- [x] **`mux watch`** — **완료** (v0.7.0): `fs.watch` 기반 파일 변경 감지 + 디바운스 + 자동 재실행. `--pattern`, `--debounce` 옵션 지원.
- [x] **Export usage stats** — **완료**: `mux export --format=csv|json --days=N`.
- [x] **Multi-model support** — **부분 완료**: 복잡도별 sonnet/opus 선택.
- [x] **Parallel Codex dispatch** — **완료** (v0.7.0): Power 티어(`concurrent: 3`)에서 `Promise.allSettled`로 배치 병렬 실행.
- [x] **Conservation mode** — **완료**: `conservation.codexFirstOnUncertain` 설정 + tiebreaker 연동.
- [x] **`mux undo`** — **완료**: 마지막 `mux:` 머지 커밋 자동 감지 + `git revert`.
- [ ] **Interactive TUI** — 패널 기반 터미널 UI (v2.0).
- [ ] **Batch mode** — `batch_mode.queue_timeout_sec` (v2.0).
- [ ] **LLM-assisted routing (hybrid engine)** — 로컬 키워드 매칭만 수행 (v2.0).
- [ ] **Remote/team budget sharing** — 팀원 간 예산 추적 공유 (v2.0).
- [ ] **Plugin ecosystem** — 플러그인 로딩/통합 메커니즘 (v2.0).

---

## Technical Debt — ALL DONE ✓

- [x] CLI test coverage (236개 테스트, 10개 파일)
- [x] Integration tests (CLI spawn E2E 6개)
- [x] Duplicated Codex execution logic
- [x] Duplicated merge/rollback logic
- [x] Custom YAML parser fragility
- [x] `parseYamlValue` null handling
- [x] Fire-and-forget async patterns
- [x] Type assertion abuse
- [x] `_options` / `_config` unused parameters
- [x] README documents features that don't exist
- [x] CI for CLI smoke tests
- [x] MCP 서버 zod dependency

---

## Ideas / Exploration

- [ ] Routing confidence threshold tuning
- [ ] User override learning effectiveness
- [ ] Cost-per-task tracking (UI 연결)
- [ ] Streaming Claude output with Markdown rendering
- [ ] Competitive positioning: killer demo
- [ ] MCP server mode health check
- [ ] Piped input mode documentation
- [ ] Web dashboard
- [ ] Decomposer 정확도 개선
