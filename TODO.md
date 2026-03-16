# agent-mux TODO

> Last updated: 2026-03-15
> Current version: v0.5.0

---

## Critical (Must fix before v1.0)

- [x] **Non-git-repo crash** — ~~Running `mux` in a non-git directory crashes with raw `fatal: not a git repository` error.~~ **완료**: `cli/index.ts`에 `isGitRepo()` 체크 추가됨. Codex 라우팅 전 git repo 여부 확인 후 친절한 에러 메시지 표시. `--route=claude` 옵션 안내도 포함.

- [x] **Version string hardcoded in 3 places** — ~~`repl.ts`, `index.ts`, `package.json`의 버전이 각각 달랐음.~~ **완료**: `cli/index.ts`와 `cli/repl.ts` 모두 `package.json`에서 `getVersion()` 함수로 동적 로딩. commander도 `.version(getVersion())` 사용.

- [x] **No graceful shutdown / Ctrl+C handling** — ~~SIGINT/SIGTERM 핸들러 없음.~~ **완료**: `cli/index.ts:40-58`에 `gracefulShutdown()` 구현. 활성 프로세스 kill + 고아 worktree 정리 + 깨끗한 종료. `process-tracker.ts`로 프로세스 추적.

- [x] **No `unhandledRejection` / `uncaughtException` handler** — ~~비동기 에러 시 raw stack trace 출력.~~ **완료**: `cli/index.ts:51-58`에 양쪽 핸들러 등록됨. 사용자 친화적 메시지 출력 후 `process.exit(1)`.

- [x] **General conversation gets routed to Claude `-p` mode awkwardly** — ~~비코딩 입력이 `claude -p` 모드로 전달됨.~~ **완료**: `routing/classifier.ts`에 `isCodingTask()` 함수 추가. `cli/run.ts:26-30`에서 비코딩 입력 감지 시 `(general chat -> Claude)` 표시 후 스트리밍 처리. 한국어 코딩 키워드도 포함.

- [x] **REPL arrow-key / history navigation broken** — ~~`terminal: false`로 인해 화살표키 히스토리 불가.~~ **완료**: `cli/repl.ts:35-43`에서 `process.stdin.isTTY` 감지 후 TTY면 `terminal: true`, 파이프면 `terminal: false`. `historySize: 100` 설정.

- [ ] **`config set` command does nothing** — `mux config key value`가 key와 value 인자를 받지만, action 핸들러(`cli/index.ts:150-158`)에서 value 파라미터를 사용하지 않음. `loadConfig()`만 호출하고 `saveConfig()`는 호출하지 않음. `config/loader.ts`에 `saveConfig()` 함수가 이미 존재하므로 연결만 하면 됨. Files: `cli/index.ts:150-158`, `config/loader.ts:148`

- [x] **Claude CLI not found gives cryptic error** — ~~ENOENT 에러를 그대로 출력.~~ **완료**: `cli/claude-spawner.ts:49-56`에서 `err.code === 'ENOENT'` 감지 후 `"Claude CLI not found. Install: npm install -g @anthropic-ai/claude-code"` 메시지 반환.

- [x] **Codex CLI not found gives no guidance at runtime** — ~~Codex 미설치 시 spawn 실패 에러.~~ **완료**: `codex/spawner.ts:136-156`에서 ENOENT 캐치 후 `"Codex CLI not found. Install: npm install -g @openai/codex"` 메시지 반환.

- [ ] **MCP 서버 버전 하드코딩** — `server.ts:19`에서 `version: '0.1.0'`으로 하드코딩. `package.json`은 `0.5.0`인데 MCP 서버는 `0.1.0` 보고. `package.json`에서 읽거나 일치시켜야 함. Files: `src/server.ts:19`

---

## High Priority (Should have for v1.0)

- [x] **General chat mode (`/chat`)** — ~~REPL에서 `/chat` 명령어 없음.~~ **완료**: `cli/repl.ts:79-87`에 `/chat <message>` 구현. Claude를 스트리밍 모드로 호출. 인자 없이 `/chat`만 입력 시 사용법 안내.

- [x] **Task history (`/history`)** — ~~REPL에서 히스토리 조회 불가.~~ **완료**: `cli/repl.ts:64-78`에 `/history` 구현. `routing/history.ts`의 `getRoutingHistory(10)` 호출 후 시간/타겟/신뢰도/태스크요약을 포맷팅하여 표시.

- [x] **Korean language routing support** — ~~분류기가 영어 패턴만 지원.~~ **완료**: `routing/classifier.ts:56-78`에 `CODEX_KEYWORDS_KO` (9패턴)과 `CLAUDE_KEYWORDS_KO` (8패턴) 추가. 테스트/문서/린트/리팩토링/아키텍처/디버그/코드리뷰/보안검사 등 포함.

- [x] **Worktree cleanup on abnormal exit** — ~~프로세스 크래시 시 고아 worktree 누적.~~ **완료**: (a) `codex/worktree.ts:58-87`에 `cleanupStaleWorktrees()` 구현, (b) `cli/index.ts:199-209`에 `mux clean` 명령어 추가, (c) `cli/index.ts:212`에서 시작 시 자동 정리(fire-and-forget), (d) `gracefulShutdown()`에서도 정리.

- [ ] **Progress feedback during Codex execution** — 현재 `ora` 스피너로 "Codex working..." 표시만 함(`cli/executor.ts:24`). 경과 시간 카운터, JSONL 이벤트 기반 상태 업데이트(e.g., "Reading files...", "Writing code..."), 복잡도 기반 예상 시간 표시 등이 필요. `codex/parser.ts`의 `JsonlStreamParser`에서 이벤트를 파싱하고 있으나 UI에 전달하지 않음. Files: `cli/executor.ts`, `codex/spawner.ts`, `codex/parser.ts`

- [x] **Timeout values hardcoded** — ~~여러 파일에 420_000, 90_000 등 하드코딩.~~ **완료**: `constants.ts`에 `CODEX_TIMEOUT_LOW/MEDIUM/HIGH`, `CODEX_TIMEOUT_PLUS_CAP`, `STALL_THRESHOLD`, `STALL_CHECK_INTERVAL`, `CLAUDE_TIMEOUT_DEFAULT` 중앙화. `executor.ts`, `spawner.ts`, `claude-spawner.ts` 모두 이 상수 참조.

- [x] **`mux init` command** — ~~프로젝트별 설정 초기화 없음.~~ **완료**: `cli/index.ts:161-196`에 `mux init` 구현. `.agent-mux/config.yaml` 생성 + `.gitignore`에 `.codex-worktrees/`와 `.agent-mux/` 추가. 이미 존재하면 경고.

- [ ] **Config validation** — 설정값 유효성 검증 없음. 잘못된 tier 이름, 음수 cost, split 합계가 100이 아닌 경우, 알 수 없는 routing engine 값 등이 무시됨. `config/loader.ts:101-139`의 `mergeWithDefaults()`에서 타입 캐스팅만 하고 범위/유효성 체크를 하지 않음. Files: `config/loader.ts`

- [ ] **`askUser()` creates a new readline interface each time** — `cli/run.ts:234-237`에서 매 호출마다 새 `createInterface` 생성/소멸. REPL 내부에서 실행 시 readline 충돌 가능. 공유 인스턴스 또는 REPL의 readline 재사용 필요. Files: `cli/run.ts:234-237`

---

## Medium Priority (Nice to have)

- [ ] **REPL prompt colorization** — `mux>` 프롬프트가 일반 텍스트. `chalk.cyan('mux>')` 등으로 컬러화하고, 선택적으로 현재 tier나 예산 상태를 인라인 표시. Files: `cli/repl.ts:40`

- [x] **Tab completion in REPL** — ~~REPL에서 `/` 명령어 자동완성 없음.~~ **완료**: `cli/repl.ts:26-33`에 `completer()` 함수 구현. `/status`, `/go`, `/config`, `/help`, `/quit`, `/chat`, `/history` 자동완성 지원.

- [x] **`--debug` / `--log-level` flag** — ~~라우팅/실행 진단 불가.~~ **완료**: `cli/debug.ts`에 `enableDebug()`/`debug()` 구현. `cli/index.ts:66`에 `--debug` 글로벌 옵션 추가. `classifier.ts`, `config/loader.ts`, `claude-spawner.ts` 등에서 `debug()` 호출로 시그널 점수, 설정 경로, 자식 프로세스 정보 stderr 출력.

- [x] **File/directory context passing** — ~~태스크에 파일 컨텍스트 전달 불가.~~ **완료**: `cli/index.ts:75,87-102`에 `-f, --file <files...>` 옵션 추가. 지정된 파일 내용을 읽어 태스크 설명에 첨부.

- [ ] **Cancel running task gracefully** — Codex 실행 중 Ctrl+C 시: (1) Codex 프로세스 kill, (2) worktree 정리, (3) REPL 프롬프트 복귀 필요. 현재 `gracefulShutdown()`이 전체 프로세스를 종료하므로 REPL 복귀 없이 프로세스 자체가 종료됨. Files: `cli/repl.ts`, `cli/executor.ts`

- [ ] **Session resume** — 세션 상태(태스크 히스토리, 대화 컨텍스트) 저장/복원. `mux --resume`으로 이전 세션 이어가기. 현재 `routing/history.ts`에 JSONL 로그가 있으나 세션 컨텍스트는 미저장.

- [x] **Auto-update notification** — ~~시작 시 업데이트 알림 없음.~~ **완료**: `cli/update-check.ts`에 npm 레지스트리에서 최신 버전 확인. `cli/index.ts:215`에서 시작 시 fire-and-forget으로 호출. 새 버전 존재 시 업데이트 안내 표시.

- [x] **Colored diff output width adaptation** — ~~diff 미리보기 박스가 고정 44자 너비.~~ **완료**: `cli/ui.ts:25-27`에 `getTerminalWidth()` 구현. `box()`와 `lightBox()` 모두 `Math.min(getTerminalWidth() - 4, 52/44)` 사용. `cli/run.ts:129`에서 diff 라인도 `termWidth - 8`로 잘라냄.

- [x] **`/go` without argument shows no error** — ~~`/go`만 입력 시 조용히 무시.~~ **완료**: `cli/repl.ts:88-90`에서 `/go` 단독 입력 시 사용법 안내 + 예시 표시.

- [x] **REPL help text doesn't explain `/go`** — ~~`/go <task>` 설명 부족.~~ **완료**: `cli/repl.ts:220`에서 `/go <task>`를 "Auto-decompose, route, and execute without confirmation"으로 설명. `/chat <msg>`도 "General chat (skip routing)"으로 설명.

- [ ] **Budget warnings use mixed Korean/English** — `budget/tracker.ts:68`의 경고 메시지가 영어로 통일됨 (예: `"Claude 90% used — recommend Codex-only mode"`). 그러나 `mux-setup.md` 커맨드 문서는 한국어, CLI 출력은 영어로 혼재. 전체적인 i18n 전략 필요. Files: `budget/tracker.ts`, `commands/*.md`

- [ ] **Empty input handling in REPL** — 빈 입력 시 프롬프트만 다시 표시(정상). 공백만 입력 시 trim 후 빈 문자열이 되어 조용히 처리됨. 반복 빈 입력 시 힌트 표시 고려. Files: `cli/repl.ts:128-130`

- [ ] **Budget tracking accuracy** — `budget/tracker.ts:100-101`의 `Math.max(disk, memory)` 패턴이 여전히 존재. 여러 세션 동시 실행 시 정확도 문제 가능. JSONL 파일 기반 집계가 소스 오브 트루스이나 `sessionClaudeMessages`와의 `Math.max` 비교가 레이스 컨디션 유발 가능. Files: `budget/tracker.ts:100-101`

---

## Low Priority (Future / v2.0)

- [ ] **Watch mode** — `mux watch "run tests on file change"` -- 파일 변경 시 태스크 재실행. TDD 워크플로에 유용.

- [ ] **Export usage stats** — `mux export --format=csv|json` 빌링 분석, 팀 리포팅, 개인 추적용.

- [ ] **Multi-model support** — Claude 모델별 라우팅(Haiku=단순, Opus=복잡) 또는 Codex 모델 다양화. `claude-spawner.ts`에 `model` 옵션은 있으나(`options?.model`) 라우팅에서 활용하지 않음.

- [ ] **Interactive TUI** — 패널 기반 터미널 UI: 태스크 목록, 예산 대시보드, 실시간 출력, 라우팅 시각화.

- [ ] **Parallel Codex dispatch for Power tier** — Power 티어 설정에서 `concurrent: 3`을 지원하나, `cli/go.ts:64`에서 항상 순차(`for...of`) 실행. 실제 병렬 실행 구현 필요.

- [ ] **Batch mode** — `batch_mode.queue_timeout_sec`이 README/커맨드 문서에 정의되어 있으나 코드에 미구현.

- [ ] **Conservation mode** — `conservation.codex_first_on_uncertain`이 README에 기술되어 있으나 `routing/classifier.ts`의 라우팅 로직에 미반영.

- [ ] **LLM-assisted routing (hybrid engine)** — `routing.engine: hybrid` 옵션이 설정에 존재하나 실제 LLM 호출 라우팅 미구현. `classifier.ts`는 로컬 키워드 매칭만 수행.

- [ ] **`mux undo`** — 마지막 Codex 머지 취소(git revert). 자동 적용된 변경이 잘못됐을 때의 안전망.

- [ ] **Remote/team budget sharing** — 팀원 간 예산 추적 공유. 공유 구독 시 한 명이 전체 예산 소진 방지.

- [ ] **Plugin ecosystem** — README에서 `harness-planner`, `architecture-enforcer`, `harness-docs` 플러그인을 언급하고, `hooks/session-start.sh`에서 감지하나, 실제 플러그인 로딩/통합 메커니즘은 없음. 감지만 되고 라우팅에 영향을 주지 않음.

---

## Technical Debt

- [ ] **Zero CLI test coverage** — `src/cli/` 전체 파일(12개)에 테스트 없음. 207개 테스트(6개 파일)가 핵심 모듈(routing, budget, codex)만 커버. 최소한 REPL 명령어 파싱, 라우팅 표시, config 명령어, setup 플로우 테스트 필요. Files: `src/cli/*.ts`

- [ ] **No integration tests** — CLI 프로세스를 실제로 spawn하여 end-to-end 동작을 검증하는 테스트 없음 (Claude/Codex 모킹 포함).

- [x] **Duplicated Codex execution logic** — ~~`run.ts`와 `go.ts`가 각각 자체 실행 로직 보유.~~ **완료**: `cli/executor.ts`로 공통 모듈 추출. `executeOnCodex()`, `executeOnClaude()`, `applyWorktreeChanges()`, `rollbackWorktree()` 함수를 `run.ts`와 `go.ts` 양쪽에서 공유.

- [x] **Duplicated merge/rollback logic** — ~~`run.ts`에서 merge/rollback 중복.~~ **완료**: `cli/executor.ts`에서 `codex/worktree.ts`의 `mergeWorktree`, `cleanupWorktree`, `removeWorktree`를 재사용.

- [x] **Custom YAML parser fragility** — ~~커스텀 YAML 파서가 멀티라인 문자열, 앵커, 별칭 미지원.~~ **완료**: `package.json`에 `yaml: ^2.8.2` 의존성 추가. `config/loader.ts:15`에서 `import YAML from 'yaml'` 사용. `parseYaml()`이 `YAML.parse()` 호출.

- [x] **`parseYamlValue` null handling** — ~~`null`/`~`가 빈 문자열로 강제 변환.~~ **완료**: 커스텀 파서 제거로 해결. `yaml` 패키지가 표준 YAML null 처리.

- [ ] **Fire-and-forget async patterns** — 여전히 다수의 `.catch(() => {})` 패턴 존재. `budget/tracker.ts:29,43`, `routing/classifier.ts:426,464`, `codex/worktree.ts` 등. `debug()` 채널로 에러 로깅 최소한 필요. Files: `budget/tracker.ts`, `routing/classifier.ts`, `cli/index.ts:212`

- [x] **Type assertion abuse** — ~~`(signals as unknown as Record<string, unknown>)[kw.signal] = true` 타입 안전성 위반.~~ **완료**: `routing/classifier.ts:119-123`에 `setSignal()` 헬퍼 함수 도입. `typeof signals[key] === 'boolean'` 런타임 체크 후 안전하게 설정.

- [x] **`_options` / `_config` unused parameters** — ~~미사용 파라미터 존재.~~ **완료**: `run.ts`와 `go.ts`에서 `options` 파라미터가 실제로 사용됨 (예: `options.dryRun`, `options.verbose`, `options.autoApply`).

- [ ] **README documents features that don't exist** — `batch_mode`, `conservation`, `degradation`, `hybrid` engine, `LLM-assisted routing`, `pipeline_mode`가 README와 커맨드 문서(`mux-config.md`, `mux-setup.md`)에 상세 기술되어 있으나 코드에 미구현. "Planned" 또는 "Coming soon" 표기 필요. Files: `README.md`, `commands/mux-config.md`, `commands/mux-setup.md`

- [ ] **No CI for CLI smoke tests** — CI가 `vitest run`으로 단위 테스트만 실행. CLI 바이너리 시작/인자파싱/정상종료 검증 없음.

- [ ] **MCP 서버 `z` import without zod dependency** — `server.ts:8`에서 `import { z } from 'zod'`하지만 `package.json`에 `zod`가 직접 dependency로 없음. `@modelcontextprotocol/sdk`의 transitive dependency에 의존 중. 명시적 추가 필요. Files: `src/server.ts:8`, `package.json`

---

## Ideas / Exploration

- [ ] **Routing confidence threshold tuning** — 현재 `CONFIDENCE_THRESHOLD` 타이브레이킹 캘리브레이션 필요. A/B 테스트 또는 사용자 피드백 수집으로 시그널 가중치 튜닝 고려.

- [ ] **User override learning effectiveness** — 학습된 오버라이드 시스템(30초 TTL 캐시, `classifier.ts:417`)이 충분한 데이터 축적이 어려울 수 있음. 더 긴 persistence + 정교한 매칭 고려. 현재 2회 이상 오버라이드 시 70% 시그널 매치로 적용(`history.ts:98,111`).

- [ ] **Cost-per-task tracking** — 태스크별 비용 추정 추적. `budget/estimator.ts` 존재하나 UI에서 미사용.

- [ ] **Streaming Claude output with Markdown rendering** — Claude 출력이 `chalk.gray` 텍스트로 스트리밍(`claude-spawner.ts:42`). `marked-terminal` 등으로 터미널 내 Markdown 렌더링 가능.

- [ ] **"Why did you route this way?" command** — `/why` 명령어로 라우팅 후 시그널 상세 분석 표시. `--verbose`의 사후 버전. `routing/history.ts`의 로그에서 마지막 결정의 `signals`와 `decision` 추출 가능.

- [ ] **Competitive positioning: killer demo** — 60초 스크린캐스트: (1) Claude 레이트 리밋 히트, (2) mux 자동 Codex 전환, (3) 태스크 완료. 핵심 가치 제안 시각화.

- [ ] **MCP server mode health check** — MCP 서버 모드 실행 시 헬스체크 엔드포인트 없음. `server.ts`에 heartbeat 또는 status 리소스 추가 고려.

- [ ] **Piped input mode documentation** — `echo "write tests" | mux`가 큐 기반 REPL 설계(`repl.ts:35, terminal: false for pipe`)로 작동하나 문서화/테스트 없음.

- [ ] **Web dashboard** — 로컬 웹 UI(localhost)로 예산 히스토리, 라우팅 결정 타임라인, 태스크 목록 시각화. 경쟁 제품 대비 차별화.

- [ ] **Decomposer 정확도 개선** — `routing/decomposer.ts`의 로컬 키워드 기반 태스크 분해가 단순 패턴 매칭에 의존. 복잡한 태스크 설명에서 서브태스크 경계 판단 정확도가 낮을 수 있음. LLM-assisted decomposition 고려.
