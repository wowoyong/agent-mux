# agent-mux TODO

> Last updated: 2026-03-16
> Current version: v0.9.0

**All planned features implemented.** Remaining items are Ideas/Exploration.

---

## Critical — ALL DONE ✓
## High Priority — ALL DONE ✓
## Medium Priority — ALL DONE ✓
## Technical Debt — ALL DONE ✓

## Low Priority — ALL DONE ✓

- [x] `mux watch` — fs.watch 파일 변경 감시 + 디바운스 재실행
- [x] `mux export` — CSV/JSON 사용량 내보내기
- [x] Multi-model support — 복잡도별 sonnet/opus 선택
- [x] Parallel Codex dispatch — Power 티어 Promise.allSettled 병렬 실행
- [x] Conservation mode — codexFirstOnUncertain tiebreaker
- [x] `mux undo` — git revert 자동 감지
- [x] `mux batch` — 큐 기반 다중 태스크 순차 실행
- [x] LLM-assisted routing — hybrid 엔진, Claude 분류 지원
- [x] Plugin ecosystem — 플러그인 감지 + AGENTS.md 컨텍스트 로딩
- [x] **Interactive TUI** — **완료** (v0.9.0): `mux tui` 명령어. ANSI 기반 3탭 대시보드 (Budget/History/Config). 자동 새로고침, 키보드 탐색.
- [x] **Remote/team budget sharing** — **완료** (v0.9.0): `mux team` 명령어. 공유 디렉토리 기반 per-user JSONL 파일 동기화. `team.sharedDir`/`team.userId` 설정 지원. 유저별 사용량 집계.

---

## Ideas / Exploration

- [x] Cost-per-task tracking — `--verbose` 모드 표시
- [x] MCP server health check — `health_check` 도구
- [ ] Routing confidence threshold tuning
- [ ] User override learning effectiveness
- [ ] Streaming Claude output with Markdown rendering
- [ ] Competitive positioning: killer demo
- [ ] Piped input mode documentation
- [ ] Web dashboard
- [ ] Decomposer 정확도 개선
