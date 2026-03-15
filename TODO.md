# agent-mux TODO

> Last updated: 2026-03-15
> Current version: v0.4.1

---

## Critical (Must fix before v1.0)

- [ ] **Non-git-repo crash** — Running `mux` in a non-git directory (e.g. home directory) crashes with raw `fatal: not a git repository` error from git worktree/codex commands. Need to detect git repo presence early and show a friendly message like `"Not a git repository. Run mux inside a project directory, or use mux --chat for general conversation."` Files: `cli/index.ts`, `codex/worktree.ts`, `codex/spawner.ts`

- [ ] **Version string hardcoded in 3 places** — `repl.ts` header says `v0.4.0`, `index.ts` (commander) says `0.3.0`, but `package.json` says `0.4.1`. These must be read from `package.json` at runtime or injected at build time. Files: `cli/repl.ts:141`, `cli/index.ts:15`

- [ ] **No graceful shutdown / Ctrl+C handling** — No `SIGINT`/`SIGTERM` handlers anywhere. Ctrl+C during a Codex task leaves orphaned worktrees and dangling git branches. Need to register signal handlers that clean up worktrees, kill child processes, and exit cleanly. Files: `cli/repl.ts`, `cli/run.ts`, `codex/spawner.ts`

- [ ] **No `unhandledRejection` / `uncaughtException` handler** — Any uncaught async error crashes the process with a raw stack trace. Add global handlers in `cli/index.ts` that log a user-friendly message and exit gracefully.

- [ ] **General conversation gets routed to Claude `-p` mode awkwardly** — Non-coding input like "hello" or "what time is it" or Korean greetings gets piped through `claude -p` which runs in non-interactive print mode. Should detect non-coding/general-chat input and either (a) spawn Claude in conversational mode, or (b) handle it inline with a message like "This doesn't look like a coding task. Use /chat for general conversation." Files: `routing/classifier.ts`, `cli/run.ts`

- [ ] **REPL arrow-key / history navigation broken** — `terminal: false` in `createInterface()` prevents double-echo but also kills arrow-key history, cursor movement, and all line-editing. Users can't press Up to recall previous commands. Need to find a solution that preserves both: consider `terminal: true` with manual echo suppression, or use a library like `inquirer`/`readline` with custom settings. Files: `cli/repl.ts:14-18`

- [ ] **`config set` command does nothing** — `mux config key value` accepts a key and value argument but the action handler only reads config, never writes. The `_value` parameter is unused. Files: `cli/index.ts:51-59`

- [ ] **Claude CLI not found gives cryptic error** — If `claude` CLI is not installed or not in PATH, `spawnClaude` throws a raw `ENOENT` error. Need to detect and show: `"Claude CLI not found. Install it: npm install -g @anthropic-ai/claude-code"`. Files: `cli/claude-spawner.ts`

- [ ] **Codex CLI not found gives no guidance at runtime** — Setup checks for Codex, but if user runs `mux "write tests"` without Codex installed, the error is raw spawn failure. Need pre-flight check before routing to Codex. Files: `cli/run.ts`, `cli/go.ts`

---

## High Priority (Should have for v1.0)

- [ ] **General chat mode (`/chat`)** — Add a REPL command `/chat` that spawns Claude in interactive conversational mode for non-coding questions. Also consider auto-detecting non-coding input and offering to switch. Files: `cli/repl.ts`, `cli/claude-spawner.ts`

- [ ] **Task history (`/history`)** — Show recent tasks with their routing decisions, execution time, and results. Data is already logged to JSONL in `routing/history.ts` but there is no CLI command to view it. Files: `cli/repl.ts`, `routing/history.ts`

- [ ] **Korean language routing support** — The classifier regex patterns are English-only. Korean task descriptions like "test jaksung" or "refactoring haejwo" don't match any keyword patterns and fall through to low-confidence tiebreaker. Add Korean keyword patterns for all signal categories. Files: `routing/classifier.ts`

- [ ] **Worktree cleanup on abnormal exit** — If the process crashes or is killed, orphaned worktrees accumulate in `.codex-worktrees/`. Add: (a) cleanup on startup via `cleanupStaleWorktrees()`, (b) `mux clean` command for manual cleanup, (c) signal handlers for graceful shutdown. Files: `codex/worktree.ts`, `cli/index.ts`

- [ ] **Progress feedback during Codex execution** — Currently shows only a spinner with "Codex working..." for up to 7 minutes. Add elapsed time counter, JSONL event status updates (e.g., "Reading files...", "Writing code..."), and optionally an ETA based on complexity estimate. Files: `cli/run.ts`, `cli/go.ts`, `codex/spawner.ts`

- [ ] **Timeout values hardcoded** — `420_000` (7 min) timeout and `90_000` (90s) stall threshold are hardcoded in multiple files. Should come from config or at least be constants in one place. Files: `cli/run.ts` (3 occurrences), `cli/go.ts` (2 occurrences), `codex/spawner.ts:62-63`

- [ ] **`mux init` command** — Project-level config initialization (like `git init`). Should create `.agent-mux/config.yaml` in the current project with sensible defaults and add `.codex-worktrees/` to `.gitignore`. Distinct from `mux setup` which is the interactive wizard. Files: `cli/index.ts`

- [ ] **Config validation** — No validation of config values. Invalid tier names, negative costs, split percentages not summing to 100, or unknown routing engine values are silently accepted. Add schema validation in `loadConfig()`. Files: `config/loader.ts`

- [ ] **`askUser()` creates a new readline interface each time** — In `run.ts:258`, each call to `askUser()` creates and destroys a new `createInterface`. This can conflict with the REPL's readline when running inside the REPL. Should reuse the REPL's readline or use a shared instance. Files: `cli/run.ts:257-260`

---

## Medium Priority (Nice to have)

- [ ] **REPL prompt colorization** — The `mux>` prompt is plain text. Should be colorized (e.g., `chalk.cyan('mux>')`) and optionally show current tier or budget status inline.

- [ ] **Tab completion in REPL** — Add completer function for `/` commands (`/status`, `/go`, `/config`, `/help`, `/quit`) and optionally for file paths.

- [ ] **`--debug` / `--log-level` flag** — No way to diagnose routing or execution issues. Add a debug mode that logs signal scores, config resolution path, and child process details to stderr or a log file.

- [ ] **File/directory context passing** — Support `mux -f src/auth.ts "fix the bug here"` to pass file context to the routing classifier and to Claude/Codex. Currently no way to specify which files the task relates to.

- [ ] **Cancel running task gracefully** — Ctrl+C during Codex execution should: (1) kill the Codex process, (2) clean up the worktree, (3) return to the REPL prompt. Currently it just kills the entire process.

- [ ] **Session resume** — Allow continuing where the user left off. Save session state (task history, conversation context) and restore on `mux` startup or with `mux --resume`.

- [ ] **Auto-update notification** — On startup, check npm registry for newer version and show a one-line notice: `"Update available: 0.4.1 -> 0.5.0. Run: npm update -g agent-mux-mcp"`.

- [ ] **Colored diff output width adaptation** — Diff preview box in `lightBox` uses fixed 44-char width. Long file paths and diff lines get truncated. Should adapt to terminal width (`process.stdout.columns`). Files: `cli/ui.ts`, `cli/run.ts`

- [ ] **Empty input handling in REPL** — Empty input just re-prints the prompt (correct), but whitespace-only input (spaces, tabs) is trimmed to empty string silently. Consider showing a subtle hint on repeated empty inputs.

- [ ] **Budget tracking accuracy** — `sessionClaudeMessages` in `tracker.ts` is an in-memory counter that starts at 0 each session. If the user runs multiple `mux` sessions in the same 5-hour window, the disk-based `getUsageSummary` should be the source of truth, but `Math.max(disk, memory)` can undercount if session has more than disk (race condition on first task). Files: `budget/tracker.ts:100-101`

- [ ] **`/go` without argument shows no error** — In REPL, typing `/go` (without a task) silently does nothing because `input.slice(4).trim()` is empty and the `if (task)` guard skips it. Should show usage hint. Files: `cli/repl.ts:39-43`

- [ ] **REPL help text doesn't explain `/go`** — Help shows `/go <task>` but doesn't explain what "auto-execute mode" means or how it differs from regular task input. Files: `cli/repl.ts:163-178`

- [ ] **Budget warnings use mixed Korean/English** — Warning messages in `tracker.ts` are partially Korean while the rest of the CLI is English. Should be consistent, or use i18n. Files: `budget/tracker.ts:67-69`

---

## Low Priority (Future / v2.0)

- [ ] **Watch mode** — `mux watch "run tests on file change"` -- file watcher that re-runs tasks on save. Useful for TDD workflows.

- [ ] **Export usage stats** — `mux export --format=csv|json` for billing analysis, team reporting, or personal tracking.

- [ ] **Multi-model support** — Allow routing to different Claude models (Haiku for simple, Opus for complex) or different Codex models.

- [ ] **Interactive TUI** — Full terminal UI with panels (like `oh-my-opencode`): task list, budget dashboard, live output, routing visualization.

- [ ] **Parallel Codex dispatch for Power tier** — Config supports `concurrent: 3` for Power tier but the code always runs Codex tasks sequentially. Implement actual parallel execution for Pro Codex subscribers.

- [ ] **Batch mode** — Queue multiple tasks and execute them with configured delays (`batch_mode.queue_timeout_sec` exists in README but not in code).

- [ ] **Conservation mode** — README mentions `conservation.codex_first_on_uncertain` but this is not implemented in the codebase.

- [ ] **LLM-assisted routing (hybrid engine)** — README mentions "hybrid" routing engine for Premium/Power tiers but only "local" keyword matching is implemented.

- [ ] **`mux undo`** — Undo the last Codex merge (git revert of the merge commit). Safety net for when auto-applied changes are wrong.

- [ ] **Remote/team budget sharing** — Share budget tracking across team members to avoid one person exhausting the shared subscription.

- [ ] **Plugin ecosystem** — README references `harness-planner`, `architecture-enforcer`, `harness-docs` plugins but no plugin loading mechanism exists in the codebase.

---

## Technical Debt

- [ ] **Zero CLI test coverage** — All files in `src/cli/` have no tests. The 207 tests cover only core modules (routing, budget, codex). Need at minimum: REPL command parsing, routing display, config command, setup flow. Files: `src/cli/*.ts`

- [ ] **No integration tests** — No test that actually spawns the CLI process and verifies end-to-end behavior (even with mocked Claude/Codex).

- [ ] **Duplicated Codex execution logic** — `run.ts` and `go.ts` each have their own `executeCodex*` and `executeClaude*` functions with near-identical code. Extract shared execution logic into a common module. Files: `cli/run.ts`, `cli/go.ts`

- [ ] **Duplicated merge/rollback logic** — `mergeAndCleanup()` and `rollback()` in `run.ts` duplicate functionality already in `codex/worktree.ts` (`mergeWorktree`, `cleanupWorktree`). Should reuse the worktree module. Files: `cli/run.ts:263-281`, `codex/worktree.ts`

- [ ] **Custom YAML parser fragility** — `config/loader.ts` implements a custom YAML parser instead of using a proper library (`js-yaml`, `yaml`). It doesn't handle multi-line strings, anchors, aliases, or edge cases. Will break on complex configs. Files: `config/loader.ts:25-78`

- [ ] **`parseYamlValue` null handling** — `null` / `~` in YAML is coerced to empty string (`'' as unknown as string`) which is a type-safety violation. Files: `config/loader.ts:83`

- [ ] **Fire-and-forget async patterns** — Multiple `.catch(() => {})` fire-and-forget patterns in budget tracking and routing logging. Silent failures make debugging impossible. At minimum log to debug channel. Files: `budget/tracker.ts`, `routing/classifier.ts`

- [ ] **Type assertion abuse** — `(signals as unknown as Record<string, unknown>)[kw.signal] = true` in classifier.ts bypasses type safety. Should use a proper typed setter or mapped type. Files: `routing/classifier.ts:95-96`

- [ ] **`_options` / `_config` unused parameters** — Multiple functions accept options/config parameters prefixed with `_` that are never used. Clean up or implement. Files: `cli/run.ts:106`, `cli/go.ts:132`

- [ ] **README documents features that don't exist** — `batch_mode`, `conservation`, `degradation`, `hybrid` engine, and `LLM-assisted routing` are all described in README but not implemented. Either implement or clearly mark as "planned".

- [ ] **No CI for CLI smoke tests** — CI runs unit tests but doesn't verify that the CLI binary actually starts, parses args, and exits cleanly.

---

## Ideas / Exploration

- [ ] **Routing confidence threshold tuning** — The current `CONFIDENCE_THRESHOLD` for tiebreaking may need calibration. Consider A/B testing or user feedback collection to tune signal weights.

- [ ] **User override learning effectiveness** — The learned override system (30s TTL cache) may not accumulate enough data to be useful. Consider longer persistence and more sophisticated matching.

- [ ] **Cost-per-task tracking** — Track estimated cost per task (not just count) to give users more meaningful budget insights. `budget/estimator.ts` exists but isn't used in the UI.

- [ ] **Streaming Claude output with Markdown rendering** — Currently Claude output is streamed as raw gray text. Could render Markdown (headers, code blocks, lists) in the terminal using `marked-terminal` or similar.

- [ ] **"Why did you route this way?" command** — After routing, allow user to ask `/why` to see detailed signal breakdown, like `--verbose` but after the fact.

- [ ] **Competitive positioning: killer demo** — A 60-second screencast showing: (1) Claude hits rate limit, (2) mux auto-switches to Codex, (3) task completes without interruption. This is the core value prop that is hard to demonstrate in README text.

- [ ] **Pricing messaging refinement** — "$40/mo for 4x coding time" is compelling but needs validation. Consider tracking actual time savings and reporting them in `mux status`.

- [ ] **MCP server mode health check** — When running as MCP server (not CLI), there is no health check endpoint or status reporting mechanism.

- [ ] **Piped input mode** — `echo "write tests" | mux` works due to the queue-based REPL design, but there is no explicit documentation or testing of this pipe mode for CI/automation use cases.

- [ ] **Web dashboard** — Long-term: a local web UI (localhost) showing budget history, routing decisions over time, and task timeline. Would differentiate from all competitors.
