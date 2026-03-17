# agent-mux Ink TUI Redesign

## Summary

Replace the current readline-based REPL and raw-ANSI dashboard with an Ink (React for CLI) TUI. Extract a UI-independent Core Engine API (`MuxEngine`) so future web/desktop apps can reuse the same logic.

## Goals

- Claude Code-quality terminal experience: markdown rendering, syntax highlighting, tool use display, thinking blocks
- Core Engine with `AsyncGenerator<MuxEvent>` API — zero UI coupling
- Header bar with budget/tier info always visible
- Streaming responses with `<Static>` for completed messages
- Future-proof: same engine powers TUI now, web app (React/Next.js + Tailscale) later

## Non-Goals

- Web app implementation (future work)
- HTTP API server (added when web app is built)
- Alternate screen mode (conversation stays in terminal scrollback)
- Mobile-specific UI

## Constraints

- TypeScript, ESM, Node 18+
- Must keep existing MCP server (`server.ts`) working unchanged
- Must keep all existing routing, budget, config, codex logic unchanged
- Legacy REPL fallback via `--legacy` flag during transition
- When `process.stdin.isTTY === false` (piped input), auto-fallback to legacy mode
- Minimum terminal width: 60 columns (show warning below this)

---

## Architecture

### Core Engine (`src/core/`)

UI-independent business logic layer. All UI consumers (TUI, web, MCP) use this API.

```typescript
// src/core/engine.ts
export interface MuxEngine {
  // Routing & execution
  analyzeAndRoute(task: string, options?: RouteOptions): Promise<RouteResult>;
  execute(task: string, decision: RouteResult): AsyncGenerator<MuxEvent>;
  chat(message: string): AsyncGenerator<MuxEvent>;

  // Decomposition (for /go command)
  decompose(task: string): Promise<DecompositionResult>;
  executeDecomposed(decomposition: DecompositionResult): AsyncGenerator<MuxEvent>;

  // Confirmation back-channel (for Codex diff Y/N/D)
  respondToConfirm(id: string, choice: string): void;

  // Cancellation
  cancel(): void;

  // State queries
  getBudget(): Promise<BudgetStatus>;
  getHistory(limit: number): Promise<RoutingEntry[]>;
  getConfig(): Promise<MuxConfig>;
  getVersion(): string;
}
```

**Type aliases**: `RouteResult` is a re-export of the existing `RouteDecision` type. `RouteOptions` wraps `{ dryRun?: boolean; route?: string; verbose?: boolean }`. `RoutingEntry` is the existing `RoutingLogEntry`.

**`chat()` semantics**: Bypasses routing, sends directly to Claude (haiku model) for non-coding conversation. Yields `stream` events only (no tool_use or thinking). This is what `/chat <msg>` invokes.

**Expected call sequence for TUI**:
```typescript
// In useEngine hook:
if (isCodingTask(input)) {
  const decision = await engine.analyzeAndRoute(input);
  // TUI renders RoutingBadge from decision
  for await (const event of engine.execute(input, decision)) {
    dispatch(event); // TUI dispatches to appropriate component
  }
} else {
  for await (const event of engine.chat(input)) {
    dispatch(event);
  }
}
```

**`budget_update` trigger**: Yielded after each task completion and when a budget warning threshold is crossed. The `useBudget` hook also polls `engine.getBudget()` every 30 seconds for header display.

**Lifecycle**: `MuxEngine` is created via `createEngine(config?)` factory. Singleton per process. Owns process tracker and session state. For future web app with concurrent users, a new engine per session will be created.

**Confirmation flow**: When the engine needs user input (e.g., Codex diff approval), it yields `{ type: 'confirm', id, prompt, options }`. The generator suspends at the `yield` point. The TUI renders the prompt and calls `engine.respondToConfirm(id, choice)`, which resolves an internal Promise and resumes the generator.

**Cancellation**: `engine.cancel()` kills all active child processes (via process-tracker) and causes the current `AsyncGenerator` to return early with `{ type: 'error', message: 'Cancelled' }`.

### Event Types (`src/core/events.ts`)

```typescript
export type MuxEvent =
  | { type: 'routing'; decision: RouteResult }
  | { type: 'stream'; chunk: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_use'; tool: string; input: any }
  | { type: 'tool_result'; output: string }
  | { type: 'diff'; patch: string; files: string[] }
  | { type: 'file_list'; files: string[]; additions: number; deletions: number }
  | { type: 'confirm'; id: string; prompt: string; options: string[] }
  | { type: 'progress'; message: string; elapsed: number }
  | { type: 'error'; message: string; recoverable: boolean }
  | { type: 'done'; summary: string }
  | { type: 'budget_update'; budget: BudgetStatus };
```

### Streaming Adapters

- `src/core/claude-stream.ts` — Wraps `claude-spawner.ts`, yields `MuxEvent` from `--output-format stream-json`
- `src/core/codex-stream.ts` — Wraps Codex JSONL output, yields `MuxEvent`
- Fallback: if stream-json unavailable, yields `{ type: 'stream' }` chunks from plain text

### Data Flow

```
User input → MuxEngine.execute() / .chat()
                │
                ▼ AsyncGenerator<MuxEvent>
                │
   ┌────────────┼────────────┐
   ▼            ▼            ▼
 Ink TUI    Web SSE      MCP Server
(now)      (future)     (existing)
```

---

## TUI Layout

```
╭─ agent-mux v0.7.0 ─── standard ($120/mo) ──────────────────╮
│ Claude ████░░░░░░ 12% (27/225) │ Codex ██░░░░░░░░ 5% (10/200) │
╰─────────────────────────────────────────────────────────────╯

  You
  야 이 함수 리팩토링해줘

  → Claude (sonnet)  complexity: medium  confidence: 87%

  Assistant
  리팩토링을 진행하겠습니다.

  ▶ Read src/utils/parser.ts (42 lines)
  ▶ Edit src/utils/parser.ts (+12, -8)

  ┌─ Diff Preview ─────────────────────────────────────────┐
  │ - const old = ...                                      │
  │ + const new = ...                                      │
  └────────────────────────────────────────────────────────┘

  Apply changes? [Y]es / [N]o / [D]iff full

╭──────────────────────────────────────────────────────────────╮
│ > 메시지 입력 또는 /command...                    ⠋ thinking │
╰──────────────────────────────────────────────────────────────╯
```

---

## Component Tree

```
<App>
├── <Header />              — budget bars + tier info, always top
├── <Static items={messages}>
│   ├── <UserMessage />     — user input display
│   ├── <RoutingBadge />    — target, confidence, reason
│   └── <AssistantMessage>
│       ├── <MarkdownBlock />   — marked-terminal rendering
│       ├── <CodeBlock />       — cli-highlight syntax coloring
│       ├── <ToolUseBlock />    — collapsible tool use display
│       ├── <ThinkingBlock />   — collapsible thinking content
│       └── <DiffPreview />     — colored unified diff
├── <StreamingArea />       — active response (re-renders on each chunk)
│   └── <Spinner />         — braille dots + elapsed time + token count
└── <InputBar />            — @inkjs/ui TextInput + slash command autocomplete
```

### Key Rendering Decisions

- `<Static>`: completed messages render once, live in terminal scrollback
- No `alternateScreen`: conversation persists after exit (Claude Code pattern)
- `<StreamingArea>`: only this re-renders during streaming (30fps cap)
- Tool/thinking blocks: collapsed by default, Tab to cycle focus, Enter to expand/collapse
- Message promotion: on `{ type: 'done' }` event, entire assistant turn moves from `StreamingArea` to `Static`
- Markdown buffering: accumulate raw text, re-parse on double-newline boundaries to avoid partial block rendering

---

## File Structure

```
src/
├── core/                          NEW
│   ├── engine.ts                  MuxEngine implementation
│   ├── events.ts                  MuxEvent type definitions
│   ├── claude-stream.ts           Claude CLI → AsyncGenerator<MuxEvent>
│   └── codex-stream.ts            Codex CLI → AsyncGenerator<MuxEvent>
│
├── cli/
│   ├── index.ts                   MODIFY — wire Ink app, keep commander
│   ├── ink/                       NEW
│   │   ├── App.tsx                Root app component
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── UserMessage.tsx
│   │   │   ├── AssistantMessage.tsx
│   │   │   ├── RoutingBadge.tsx
│   │   │   ├── CodeBlock.tsx
│   │   │   ├── ToolUseBlock.tsx
│   │   │   ├── DiffPreview.tsx
│   │   │   ├── ThinkingBlock.tsx
│   │   │   ├── StreamingArea.tsx
│   │   │   ├── InputBar.tsx
│   │   │   └── Spinner.tsx
│   │   └── hooks/
│   │       ├── useEngine.ts
│   │       ├── useMessages.ts
│   │       └── useBudget.ts
│   │
│   ├── claude-spawner.ts          KEEP (wrapped by core/claude-stream.ts)
│   ├── executor.ts                DEPRECATE (absorbed into engine.ts)
│   ├── run.ts                     DEPRECATE (absorbed into engine.ts)
│   ├── repl.ts                    DEPRECATE (replaced by ink/App.tsx)
│   ├── tui.ts                     DEPRECATE (replaced by ink/App.tsx)
│   ├── ui.ts                      KEEP (utility functions)
│   ├── debug.ts                   KEEP
│   ├── process-tracker.ts         KEEP
│   ├── session.ts                 KEEP
│   └── plugins.ts                 KEEP
│
├── routing/                       KEEP (all files unchanged)
├── budget/                        KEEP (all files unchanged)
├── config/                        KEEP (all files unchanged)
├── codex/                         KEEP (all files unchanged)
└── server.ts                      KEEP (MCP server unchanged)
```

---

## Dependencies

### Add

| Package | Purpose |
|---------|---------|
| `ink` (5.x) | React terminal renderer |
| `react` (18.x) | Peer dependency for Ink |
| `@inkjs/ui` | TextInput, Spinner, Select components |
| `marked` | Markdown parser |
| `marked-terminal` | Markdown → ANSI renderer |
| `cli-highlight` | Syntax highlighting for code blocks |
| `@types/react` | TypeScript types |

### Remove

| Package | Reason |
|---------|--------|
| `ora` | Replaced by Ink Spinner component |

### tsconfig Change

```json
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

---

## Slash Commands

Carried over from current REPL, handled in `<InputBar>` with autocomplete:

| Command | Action |
|---------|--------|
| `/status` | Toggle header to expanded budget view |
| `/go <task>` | Auto-decompose + execute without confirmation |
| `/chat <msg>` | Force general chat (skip routing) |
| `/history` | Show routing history inline |
| `/why` | Explain last routing decision |
| `/config` | Show/edit config |
| `/help` | Show command reference |
| `/quit` | Save session, exit |

---

## Ctrl+C Behavior

| TUI State | Single Ctrl+C | Double Ctrl+C |
|-----------|--------------|---------------|
| Idle (input bar) | Show "Use /quit to exit" | Force exit |
| Streaming response | Cancel current task, return to input | Force exit |
| Confirmation prompt (Y/N/D) | Discard, return to input | Force exit |
| `/go` multi-task | Cancel current subtask, skip remaining | Force exit |

Implementation: `engine.cancel()` kills child processes. Double Ctrl+C detected with 500ms window.

---

## Subcommand Strategy

| Command | Ink TUI? | Notes |
|---------|----------|-------|
| `mux` (no args) | Yes | Full Ink REPL |
| `mux "task"` (one-shot) | Yes | Ink renders, then exits on `done` |
| `mux go <task>` | Yes | Ink renders decomposition + execution |
| `mux status` | No | Plain text (quick output, then exit) |
| `mux setup` | Yes | Ink Select for plan picker |
| `mux config` | No | Plain text JSON dump |
| `mux watch` | Yes | Ink renders re-run cycles |
| `mux batch` | No | Reads stdin, plain text (non-TTY compatible) |
| `mux tui` | Removed | Merged into main `mux` REPL |
| `mux undo/clean/export/init` | No | Simple commands, unchanged |

---

## Korean IME Handling

Known risk: `@inkjs/ui` TextInput uses character-by-character model which may interrupt Korean IME composition.

**Strategy**:
1. Spike test Korean IME with `@inkjs/ui` TextInput before Phase 3 (Ink apps)
2. If composition breaks: build a custom `<KoreanInput>` component using raw `useStdin` + manual composition tracking
3. Fallback: use `readline` in raw mode wrapped as an Ink component (hybrid approach, proven to work from current REPL)

---

## Error Handling

| Error Type | TUI Behavior |
|------------|-------------|
| Auth expired (401) | Show inline error with "Run `claude login`" hint, return to input |
| Claude CLI not found | Show install instruction, return to input |
| Rate limit (429) | Show "Rate limited, retry in Xs" with countdown |
| Codex task failure | Show error, offer escalation to Claude |
| Network error | Show error inline, return to input |
| Process timeout | Kill process, show timeout message, return to input |

All errors are `{ type: 'error', message, recoverable }`. Recoverable errors return to input bar. Non-recoverable errors trigger graceful shutdown.

---

## Migration Strategy

1. New Ink TUI is the default when running `mux`
2. `mux --legacy` falls back to existing readline REPL
3. Old `repl.ts`, `run.ts`, `executor.ts`, `tui.ts` kept but marked deprecated
4. Once Ink TUI is stable, deprecated files are removed
5. All existing tests for routing/budget/config remain unchanged
6. New tests added for Core Engine API and Ink component rendering

---

## Design Palette

- **3+2 color rule**: text (white), muted (gray), bg (terminal default) + accent cyan (user), accent green (assistant)
- Rounded borders `╭╮╰╯` for primary boxes
- Braille spinner `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`
- Status colors: muted red (error), muted yellow (warning), muted green (success)
- Dimmed gray for metadata (timestamps, token counts, routing details)

---

## Future: Web App Extension

When building the web app:

1. Create `packages/web/` (or `src/web/`)
2. Add HTTP API layer (Express/Fastify) that wraps `MuxEngine`
3. Stream `MuxEvent` via SSE or WebSocket
4. React frontend consumes same event types
5. Access via Tailscale from mobile/desktop browsers
6. Core Engine and all business logic shared — zero duplication

---

## Known Tech Debt

- `server.ts` (MCP server) still uses old code paths, not `MuxEngine`. Will be migrated in a follow-up when web app work begins.
- `--output-format stream-json` requires recent Claude CLI. Plain text fallback degrades gracefully (no tool_use/thinking events, only stream chunks).
- `marked-terminal` ANSI output compatibility with Ink's `<Text>` needs validation spike.
