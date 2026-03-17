# Ink TUI Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace readline REPL with Ink (React for CLI) TUI, extracting a UI-independent Core Engine for future web app reuse.

**Architecture:** Core Engine (`src/core/`) provides `AsyncGenerator<MuxEvent>` streaming API. Ink TUI (`src/cli/ink/`) consumes events via React hooks. Existing routing/budget/config/codex modules unchanged.

**Tech Stack:** Ink 5, React 18, @inkjs/ui 2, marked + marked-terminal, cli-highlight, TypeScript with JSX

**Spec:** `docs/superpowers/specs/2026-03-17-ink-tui-redesign.md`

---

## Chunk 1: Infrastructure Setup

### Task 1: Add Dependencies and Configure TSX

**Files:**
- Modify: `packages/agent-mux-mcp/package.json`
- Modify: `packages/agent-mux-mcp/tsconfig.json`
- Create: `packages/agent-mux-mcp/src/marked-terminal.d.ts`

- [ ] **Step 1: Install Ink, React, and UI dependencies**

```bash
cd packages/agent-mux-mcp
npm install ink@5.2.1 react@18.3.1 @inkjs/ui@2.0.0 marked@15.0.7 marked-terminal@7.3.0 cli-highlight@2.1.11
npm install -D @types/react@18.3.28
```

- [ ] **Step 2: Add JSX support to tsconfig.json**

In `packages/agent-mux-mcp/tsconfig.json`, add `"jsx": "react-jsx"` to `compilerOptions`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    ...rest stays the same
  }
}
```

- [ ] **Step 3: Create marked-terminal type declaration**

Create `packages/agent-mux-mcp/src/marked-terminal.d.ts`:

```typescript
declare module "marked-terminal" {
  import type { MarkedExtension } from "marked";

  interface TerminalRendererOptions {
    code?: (...args: unknown[]) => string;
    blockquote?: (text: string) => string;
    heading?: (text: string, level: number) => string;
    firstHeading?: (text: string, level: number) => string;
    strong?: (text: string) => string;
    em?: (text: string) => string;
    codespan?: (text: string) => string;
    link?: (href: string, title: string, text: string) => string;
    width?: number;
    reflowText?: boolean;
    showSectionPrefix?: boolean;
    emoji?: boolean;
    tab?: number;
  }

  interface HighlightOptions {
    language?: string;
    ignoreIllegals?: boolean;
  }

  export function markedTerminal(
    options?: TerminalRendererOptions,
    highlightOptions?: HighlightOptions
  ): MarkedExtension;
}
```

- [ ] **Step 4: Verify build succeeds**

```bash
cd packages/agent-mux-mcp && npm run build
```

Expected: Clean compile with zero errors.

- [ ] **Step 5: Verify existing tests still pass**

```bash
cd packages/agent-mux-mcp && npm test
```

Expected: All 236 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/agent-mux-mcp/package.json packages/agent-mux-mcp/package-lock.json packages/agent-mux-mcp/tsconfig.json packages/agent-mux-mcp/src/marked-terminal.d.ts
git commit -m "chore: add Ink, React, marked dependencies and TSX support"
```

---

## Chunk 2: Core Engine — Event Types and Engine Interface

### Task 2: Define MuxEvent types

**Files:**
- Create: `packages/agent-mux-mcp/src/core/events.ts`

- [ ] **Step 1: Write the event type definitions**

Create `packages/agent-mux-mcp/src/core/events.ts`:

```typescript
import type { BudgetStatus, RouteDecision, RouteTarget } from '../types.js';

/** Alias RouteDecision as RouteResult for the public engine API */
export type RouteResult = RouteDecision;

export interface RouteOptions {
  dryRun?: boolean;
  route?: RouteTarget;
  verbose?: boolean;
}

/**
 * All events emitted by MuxEngine during execution.
 * TUI and future web app both consume this stream.
 */
export type MuxEvent =
  | { type: 'routing'; decision: RouteResult }
  | { type: 'stream'; chunk: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_use'; tool: string; input: Record<string, unknown> }
  | { type: 'tool_result'; output: string }
  | { type: 'diff'; patch: string; files: string[] }
  | { type: 'file_list'; files: string[]; additions: number; deletions: number }
  | { type: 'confirm'; id: string; prompt: string; options: string[] }
  | { type: 'progress'; message: string; elapsed: number }
  | { type: 'error'; message: string; recoverable: boolean }
  | { type: 'done'; summary: string }
  | { type: 'budget_update'; budget: BudgetStatus };
```

- [ ] **Step 2: Verify build**

```bash
cd packages/agent-mux-mcp && npm run build
```

Expected: Clean compile.

- [ ] **Step 3: Commit**

```bash
git add packages/agent-mux-mcp/src/core/events.ts
git commit -m "feat(core): add MuxEvent type definitions"
```

### Task 3: Define MuxEngine interface and factory

**Files:**
- Create: `packages/agent-mux-mcp/src/core/engine.ts`
- Create: `packages/agent-mux-mcp/src/core/engine.test.ts`

- [ ] **Step 1: Write failing test for engine creation**

Create `packages/agent-mux-mcp/src/core/engine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createEngine } from './engine.js';

describe('MuxEngine', () => {
  it('creates engine with default config', async () => {
    const engine = await createEngine();
    expect(engine).toBeDefined();
    expect(engine.getVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('exposes getBudget', async () => {
    const engine = await createEngine();
    const budget = await engine.getBudget();
    expect(budget).toHaveProperty('claude');
    expect(budget).toHaveProperty('codex');
  });

  it('exposes getConfig', async () => {
    const engine = await createEngine();
    const config = await engine.getConfig();
    expect(config).toHaveProperty('tier');
    expect(config).toHaveProperty('routing');
  });

  it('exposes getHistory', async () => {
    const engine = await createEngine();
    const history = await engine.getHistory(5);
    expect(Array.isArray(history)).toBe(true);
  });

  it('isCodingTask classifies general chat', async () => {
    const engine = await createEngine();
    expect(engine.isCodingTask('안녕하세요')).toBe(false);
    expect(engine.isCodingTask('fix the auth bug in login.ts')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/agent-mux-mcp && npx vitest run src/core/engine.test.ts
```

Expected: FAIL — `createEngine` not found.

- [ ] **Step 3: Implement MuxEngine**

Create `packages/agent-mux-mcp/src/core/engine.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../config/loader.js';
import { getBudgetStatus } from '../budget/tracker.js';
import { getRoutingHistory } from '../routing/history.js';
import { analyzeTask, routeTask, routeTaskHybrid, isCodingTask } from '../routing/classifier.js';
import { registerProcess, unregisterProcess, getActiveProcesses } from '../cli/process-tracker.js';
import type { MuxConfig, BudgetStatus, RouteDecision, RoutingLogEntry, DecompositionResult } from '../types.js';
import type { MuxEvent, RouteResult, RouteOptions } from './events.js';

export interface MuxEngine {
  analyzeAndRoute(task: string, options?: RouteOptions): Promise<RouteResult>;
  execute(task: string, decision: RouteResult): AsyncGenerator<MuxEvent>;
  chat(message: string): AsyncGenerator<MuxEvent>;
  decompose(task: string): Promise<DecompositionResult>;
  executeDecomposed(decomposition: DecompositionResult): AsyncGenerator<MuxEvent>;
  respondToConfirm(id: string, choice: string): void;
  cancel(): void;
  isCodingTask(task: string): boolean;
  getBudget(): Promise<BudgetStatus>;
  getHistory(limit: number): Promise<RoutingLogEntry[]>;
  getConfig(): Promise<MuxConfig>;
  getVersion(): string;
}

// Pending confirmations — resolve Promises to resume generators
const confirmations = new Map<string, (choice: string) => void>();

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf-8'));
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

export async function createEngine(configOverride?: Partial<MuxConfig>): Promise<MuxEngine> {
  const config = configOverride
    ? { ...(await loadConfig()), ...configOverride } as MuxConfig
    : await loadConfig();

  const engine: MuxEngine = {
    async analyzeAndRoute(task: string, options?: RouteOptions): Promise<RouteResult> {
      if (options?.route) {
        const signals = analyzeTask(task);
        return {
          target: options.route,
          confidence: 1.0,
          reason: `Forced route to ${options.route}`,
          signals,
          escalated: false,
        };
      }

      const budget = await getBudgetStatus();
      const claudePct = budget.claude.usagePercent / 100;
      const codexPct = budget.codex.usagePercent / 100;
      const conservationMode = config.conservation?.codexFirstOnUncertain ?? false;

      if (config.routing.engine === 'hybrid') {
        return routeTaskHybrid(task, config.tier, claudePct, codexPct, { conservationMode });
      }

      const signals = analyzeTask(task);
      return routeTask(signals, config.tier, claudePct, codexPct, task, { conservationMode });
    },

    async *execute(_task: string, _decision: RouteResult): AsyncGenerator<MuxEvent> {
      // Stub — implemented in Task 4 (claude-stream) and Task 5 (codex-stream)
      yield { type: 'error', message: 'execute() not yet implemented', recoverable: true };
    },

    async *chat(_message: string): AsyncGenerator<MuxEvent> {
      // Stub — implemented in Task 4 (claude-stream)
      yield { type: 'error', message: 'chat() not yet implemented', recoverable: true };
    },

    async decompose(_task: string): Promise<DecompositionResult> {
      // Stub — wired in Task 5
      const { decomposeTask } = await import('../routing/decomposer.js');
      return decomposeTask(_task);
    },

    async *executeDecomposed(_decomposition: DecompositionResult): AsyncGenerator<MuxEvent> {
      // Stub — implemented in later task
      yield { type: 'error', message: 'executeDecomposed() not yet implemented', recoverable: true };
    },

    respondToConfirm(id: string, choice: string): void {
      const resolve = confirmations.get(id);
      if (resolve) {
        resolve(choice);
        confirmations.delete(id);
      }
    },

    cancel(): void {
      const procs = getActiveProcesses();
      for (const proc of procs) {
        proc.kill('SIGTERM');
      }
    },

    isCodingTask(task: string): boolean {
      return isCodingTask(task);
    },

    async getBudget(): Promise<BudgetStatus> {
      return getBudgetStatus();
    },

    async getHistory(limit: number): Promise<RoutingLogEntry[]> {
      return getRoutingHistory(limit);
    },

    async getConfig(): Promise<MuxConfig> {
      return config;
    },

    getVersion,
  };

  return engine;
}

/** Helper for generators that need to wait for user confirmation */
export function waitForConfirm(id: string): Promise<string> {
  return new Promise((resolve) => {
    confirmations.set(id, resolve);
  });
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/agent-mux-mcp && npx vitest run src/core/engine.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/agent-mux-mcp/src/core/
git commit -m "feat(core): MuxEngine interface, factory, and basic tests"
```

---

### Task 4: Claude streaming adapter

**Files:**
- Create: `packages/agent-mux-mcp/src/core/claude-stream.ts`
- Create: `packages/agent-mux-mcp/src/core/claude-stream.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent-mux-mcp/src/core/claude-stream.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { parseClaudeStreamEvent } from './claude-stream.js';

describe('parseClaudeStreamEvent', () => {
  it('parses assistant text as stream event', () => {
    const event = parseClaudeStreamEvent({ type: 'assistant', content: 'hello' });
    expect(event).toEqual({ type: 'stream', chunk: 'hello' });
  });

  it('parses tool_use event', () => {
    const event = parseClaudeStreamEvent({ type: 'tool_use', name: 'Read', input: { path: 'foo.ts' } });
    expect(event).toEqual({ type: 'tool_use', tool: 'Read', input: { path: 'foo.ts' } });
  });

  it('parses tool_result event', () => {
    const event = parseClaudeStreamEvent({ type: 'tool_result', content: 'file contents' });
    expect(event).toEqual({ type: 'tool_result', output: 'file contents' });
  });

  it('parses thinking event', () => {
    const event = parseClaudeStreamEvent({ type: 'thinking', content: 'reasoning...' });
    expect(event).toEqual({ type: 'thinking', content: 'reasoning...' });
  });

  it('returns null for unknown event types', () => {
    const event = parseClaudeStreamEvent({ type: 'unknown_type' });
    expect(event).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/agent-mux-mcp && npx vitest run src/core/claude-stream.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement claude-stream adapter**

Create `packages/agent-mux-mcp/src/core/claude-stream.ts`:

```typescript
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { registerProcess, unregisterProcess } from '../cli/process-tracker.js';
import { debug } from '../cli/debug.js';
import { CLAUDE_TIMEOUT_DEFAULT } from '../constants.js';
import type { MuxEvent } from './events.js';

interface ClaudeStreamEvent {
  type: string;
  content?: string;
  name?: string;
  input?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Parse a single Claude stream-json event into a MuxEvent */
export function parseClaudeStreamEvent(event: ClaudeStreamEvent): MuxEvent | null {
  switch (event.type) {
    case 'assistant':
      return { type: 'stream', chunk: event.content ?? '' };
    case 'tool_use':
      return { type: 'tool_use', tool: event.name ?? 'unknown', input: event.input ?? {} };
    case 'tool_result':
      return { type: 'tool_result', output: event.content ?? '' };
    case 'thinking':
      return { type: 'thinking', content: event.content ?? '' };
    default:
      return null;
  }
}

/** Auth error detection (from claude-spawner.ts) */
function isAuthError(text: string): boolean {
  return /401|authentication_error|OAuth.*expired|token.*expired|Failed to authenticate/i.test(text);
}

/**
 * Spawn Claude CLI and yield MuxEvent stream.
 * Tries --output-format stream-json first, falls back to plain text.
 */
export async function* streamClaude(
  prompt: string,
  options?: { model?: string; timeout?: number }
): AsyncGenerator<MuxEvent> {
  const args = ['-p', prompt];
  if (options?.model) args.push('--model', options.model);
  args.push('--output-format', 'stream-json');

  debug('streamClaude: spawning with args', args);
  const proc = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  registerProcess(proc);

  let stderr = '';
  let useJsonMode = true;
  const timeout = options?.timeout ?? CLAUDE_TIMEOUT_DEFAULT;

  // Timeout handler
  const timer = setTimeout(() => {
    proc.kill('SIGTERM');
  }, timeout);

  proc.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
    if (isAuthError(stderr)) {
      proc.kill('SIGTERM');
    }
  });

  try {
    const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;

      if (useJsonMode) {
        try {
          const parsed: ClaudeStreamEvent = JSON.parse(line);
          const event = parseClaudeStreamEvent(parsed);
          if (event) yield event;
        } catch {
          // JSON parse failed — switch to plain text fallback
          useJsonMode = false;
          yield { type: 'stream', chunk: line };
        }
      } else {
        yield { type: 'stream', chunk: line };
      }
    }

    // Wait for process to close
    const exitCode = await new Promise<number>((resolve) => {
      proc.on('close', (code) => resolve(code ?? 1));
    });

    if (exitCode !== 0 && stderr.trim()) {
      if (isAuthError(stderr)) {
        yield { type: 'error', message: 'Authentication failed — Run `claude login` to re-authenticate.', recoverable: true };
      } else {
        yield { type: 'error', message: stderr.trim(), recoverable: true };
      }
    }
  } finally {
    clearTimeout(timer);
    unregisterProcess(proc);
  }

  yield { type: 'done', summary: '' };
}

/**
 * Chat mode — uses haiku model, plain text, shorter timeout.
 */
export async function* streamChat(message: string): AsyncGenerator<MuxEvent> {
  yield* streamClaude(message, { model: 'haiku', timeout: 60_000 });
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/agent-mux-mcp && npx vitest run src/core/claude-stream.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 5: Build check**

```bash
cd packages/agent-mux-mcp && npm run build
```

Expected: Clean compile.

- [ ] **Step 6: Commit**

```bash
git add packages/agent-mux-mcp/src/core/claude-stream.ts packages/agent-mux-mcp/src/core/claude-stream.test.ts
git commit -m "feat(core): Claude streaming adapter with stream-json and plain text fallback"
```

---

### Task 5: Wire execute() and chat() into engine

**Files:**
- Modify: `packages/agent-mux-mcp/src/core/engine.ts`

- [ ] **Step 1: Write failing test for chat()**

Add to `packages/agent-mux-mcp/src/core/engine.test.ts`:

```typescript
import { vi } from 'vitest';

// Mock claude-stream to avoid spawning real processes
vi.mock('./claude-stream.js', () => ({
  streamClaude: async function* () {
    yield { type: 'stream', chunk: 'hello from claude' };
    yield { type: 'done', summary: '' };
  },
  streamChat: async function* () {
    yield { type: 'stream', chunk: 'chat response' };
    yield { type: 'done', summary: '' };
  },
}));

describe('MuxEngine execute/chat', () => {
  it('chat() yields stream events', async () => {
    const engine = await createEngine();
    const events: MuxEvent[] = [];
    for await (const event of engine.chat('hello')) {
      events.push(event);
    }
    expect(events.some(e => e.type === 'stream')).toBe(true);
    expect(events.some(e => e.type === 'done')).toBe(true);
  });

  it('execute() yields routing then stream events', async () => {
    const engine = await createEngine();
    const decision = await engine.analyzeAndRoute('fix the bug in auth.ts');
    const events: MuxEvent[] = [];
    for await (const event of engine.execute('fix the bug', decision)) {
      events.push(event);
    }
    expect(events.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/agent-mux-mcp && npx vitest run src/core/engine.test.ts
```

Expected: FAIL — chat/execute yield stub error events.

- [ ] **Step 3: Wire streaming into engine.ts**

Update `engine.ts` — replace the `execute()` and `chat()` stubs:

```typescript
// Add import at top of engine.ts
import { streamClaude, streamChat } from './claude-stream.js';
import { appendUsageRecord } from '../budget/persistence.js';
import { streamCodex } from './codex-stream.js';

// Replace execute() stub:
async *execute(task: string, decision: RouteResult): AsyncGenerator<MuxEvent> {
  if (decision.target === 'claude') {
    const model = decision.signals.estimatedComplexity === 'high' ? undefined : 'sonnet';
    for await (const event of streamClaude(task, { model })) {
      yield event;
    }
    await appendUsageRecord('claude', task);
  } else {
    for await (const event of streamCodex(task)) {
      yield event;
      // Pause on confirmation events — engine.respondToConfirm() resumes
      if (event.type === 'confirm') {
        const choice = await waitForConfirm(event.id);
        yield { type: 'stream', chunk: `\nChoice: ${choice}\n` };
      }
    }
    await appendUsageRecord('codex', task);
  }

  const budget = await getBudgetStatus();
  yield { type: 'budget_update', budget };
},

// Replace chat() stub:
async *chat(message: string): AsyncGenerator<MuxEvent> {
  for await (const event of streamChat(message)) {
    yield event;
  }
  const budget = await getBudgetStatus();
  yield { type: 'budget_update', budget };
},
```

- [ ] **Step 4: Run tests**

```bash
cd packages/agent-mux-mcp && npx vitest run src/core/engine.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd packages/agent-mux-mcp && npm test
```

Expected: All tests pass (existing + new).

- [ ] **Step 6: Commit**

```bash
git add packages/agent-mux-mcp/src/core/
git commit -m "feat(core): wire execute() and chat() to Claude streaming adapter"
```

---

### Task 5b: Codex streaming adapter

**Files:**
- Create: `packages/agent-mux-mcp/src/core/codex-stream.ts`
- Create: `packages/agent-mux-mcp/src/core/codex-stream.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent-mux-mcp/src/core/codex-stream.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseCodexEvent } from './codex-stream.js';

describe('parseCodexEvent', () => {
  it('parses message.completed as stream event', () => {
    const event = parseCodexEvent({ type: 'message.completed', content: 'done code' });
    expect(event).toEqual({ type: 'stream', chunk: 'done code' });
  });

  it('parses files_modified as file_list event', () => {
    const event = parseCodexEvent({
      type: 'files_modified',
      files: ['a.ts', 'b.ts'],
      additions: 10,
      deletions: 3,
    });
    expect(event).toEqual({ type: 'file_list', files: ['a.ts', 'b.ts'], additions: 10, deletions: 3 });
  });

  it('returns null for unknown events', () => {
    expect(parseCodexEvent({ type: 'unknown' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/agent-mux-mcp && npx vitest run src/core/codex-stream.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement codex-stream adapter**

Create `packages/agent-mux-mcp/src/core/codex-stream.ts`:

```typescript
import { spawnWithRetry } from '../codex/retry.js';
import { CODEX_TIMEOUT_MEDIUM } from '../constants.js';
import type { MuxEvent } from './events.js';
import { waitForConfirm } from './engine.js';

interface CodexStreamEvent {
  type: string;
  content?: string;
  files?: string[];
  additions?: number;
  deletions?: number;
  [key: string]: unknown;
}

/** Parse a Codex JSONL event into MuxEvent */
export function parseCodexEvent(event: CodexStreamEvent): MuxEvent | null {
  switch (event.type) {
    case 'message.completed':
    case 'turn.completed':
      return { type: 'stream', chunk: event.content ?? '' };
    case 'files_modified':
      return {
        type: 'file_list',
        files: event.files ?? [],
        additions: event.additions ?? 0,
        deletions: event.deletions ?? 0,
      };
    default:
      return null;
  }
}

/**
 * Execute a task on Codex and yield MuxEvent stream.
 * Includes diff preview and confirmation flow.
 */
export async function* streamCodex(task: string): AsyncGenerator<MuxEvent> {
  const start = Date.now();

  yield { type: 'progress', message: 'Codex working...', elapsed: 0 };

  const progressInterval = setInterval(() => {
    // Progress updates handled by caller polling
  }, 1000);

  try {
    const result = await spawnWithRetry({
      prompt: task,
      complexity: 'medium',
      timeout: CODEX_TIMEOUT_MEDIUM,
    }, {
      onProgress: (event) => {
        // Note: cannot yield from callback — progress is best-effort
      },
    });

    clearInterval(progressInterval);

    if (result.finalResult.success) {
      // Report modified files
      if (result.finalResult.filesModified.length > 0) {
        yield {
          type: 'file_list',
          files: result.finalResult.filesModified,
          additions: 0,
          deletions: 0,
        };
      }

      // Show diff if worktree has changes
      if (result.finalResult.worktreePath && result.finalResult.filesModified.length > 0) {
        const { execFile } = await import('node:child_process');
        const { promisify } = await import('node:util');
        const execAsync = promisify(execFile);

        try {
          const { stdout: diff } = await execAsync('git', ['diff', 'HEAD'], {
            cwd: result.finalResult.worktreePath,
          });

          yield {
            type: 'diff',
            patch: diff,
            files: result.finalResult.filesModified,
          };

          // Ask for confirmation
          const confirmId = `codex-${Date.now()}`;
          yield {
            type: 'confirm',
            id: confirmId,
            prompt: 'Apply changes? [Y]es / [N]o / [D]iff full',
            options: ['Y', 'N', 'D'],
          };
        } catch {
          yield { type: 'error', message: 'Failed to generate diff', recoverable: true };
        }
      }

      yield {
        type: 'done',
        summary: `${result.finalResult.filesModified.length} files modified (${Math.round((Date.now() - start) / 1000)}s)`,
      };
    } else {
      if (result.escalatedToClaude) {
        yield { type: 'stream', chunk: 'Escalating to Claude...\n' };
      }
      yield {
        type: 'error',
        message: result.finalResult.stderr?.slice(0, 200) ?? 'Codex task failed',
        recoverable: true,
      };
      yield { type: 'done', summary: 'failed' };
    }
  } catch (err: unknown) {
    clearInterval(progressInterval);
    const msg = err instanceof Error ? err.message : String(err);
    yield { type: 'error', message: `Codex execution failed: ${msg}`, recoverable: true };
    yield { type: 'done', summary: 'error' };
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/agent-mux-mcp && npx vitest run src/core/codex-stream.test.ts
```

Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/agent-mux-mcp/src/core/codex-stream.ts packages/agent-mux-mcp/src/core/codex-stream.test.ts
git commit -m "feat(core): Codex streaming adapter with diff and confirmation flow"
```

---

## Chunk 3: Ink TUI — Base Components

### Task 6: App shell + Header component

**Files:**
- Create: `packages/agent-mux-mcp/src/cli/ink/App.tsx`
- Create: `packages/agent-mux-mcp/src/cli/ink/components/Header.tsx`

- [ ] **Step 1: Create Header component**

Create `packages/agent-mux-mcp/src/cli/ink/components/Header.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";
import type { BudgetStatus, MuxConfig } from "../../../types.js";

interface HeaderProps {
  version: string;
  config: MuxConfig;
  budget: BudgetStatus & { warnings?: Array<{ level: string; message: string }> };
}

function bar(pct: number, width = 10): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}

export const Header: React.FC<HeaderProps> = ({ version, config, budget }) => {
  const claudePct = Math.round(budget.claude.usagePercent);
  const codexPct = Math.round(budget.codex.usagePercent);
  const cost = config.claude.cost + config.codex.cost;

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      flexDirection="row"
      justifyContent="space-between"
    >
      <Text>
        <Text bold>agent-mux</Text>
        <Text dimColor> v{version} </Text>
        <Text dimColor>| {config.tier} (${cost}/mo)</Text>
      </Text>
      <Text>
        <Text color="blue">Claude </Text>
        <Text color={claudePct >= 90 ? "red" : claudePct >= 75 ? "yellow" : "green"}>
          {bar(claudePct)}
        </Text>
        <Text dimColor> {claudePct}%</Text>
        <Text dimColor> | </Text>
        <Text color="green">Codex </Text>
        <Text color={codexPct >= 90 ? "red" : codexPct >= 75 ? "yellow" : "green"}>
          {bar(codexPct)}
        </Text>
        <Text dimColor> {codexPct}%</Text>
      </Text>
    </Box>
  );
};
```

- [ ] **Step 2: Create App shell**

Create `packages/agent-mux-mcp/src/cli/ink/App.tsx`:

```tsx
import React, { useState, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import { Header } from "./components/Header.js";
import { createEngine } from "../../core/engine.js";
import type { MuxEngine } from "../../core/engine.js";
import type { BudgetStatus, MuxConfig } from "../../types.js";

export const App: React.FC = () => {
  const { exit } = useApp();
  const [engine, setEngine] = useState<MuxEngine | null>(null);
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [config, setConfig] = useState<MuxConfig | null>(null);
  const [version, setVersion] = useState("0.0.0");

  useEffect(() => {
    (async () => {
      const eng = await createEngine();
      setEngine(eng);
      setVersion(eng.getVersion());
      setConfig(await eng.getConfig());
      setBudget(await eng.getBudget());
    })();
  }, []);

  if (!engine || !budget || !config) {
    return <Text dimColor>Loading...</Text>;
  }

  return (
    <Box flexDirection="column">
      <Header version={version} config={config} budget={budget as any} />
      <Box paddingX={1} marginTop={1}>
        <Text dimColor>Ready. Type a task or /help for commands.</Text>
      </Box>
    </Box>
  );
};
```

- [ ] **Step 3: Verify build**

```bash
cd packages/agent-mux-mcp && npm run build
```

Expected: Clean compile.

- [ ] **Step 4: Commit**

```bash
git add packages/agent-mux-mcp/src/cli/ink/
git commit -m "feat(tui): App shell and Header component"
```

---

### Task 7: InputBar component

**Files:**
- Create: `packages/agent-mux-mcp/src/cli/ink/components/InputBar.tsx`

- [ ] **Step 1: Implement InputBar with slash command autocomplete**

Create `packages/agent-mux-mcp/src/cli/ink/components/InputBar.tsx`:

```tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput } from "@inkjs/ui";

const COMMANDS = ["/status", "/go", "/chat", "/history", "/why", "/config", "/help", "/quit"];

interface InputBarProps {
  onSubmit: (input: string) => void;
  isDisabled?: boolean;
  statusText?: string;
}

export const InputBar: React.FC<InputBarProps> = ({ onSubmit, isDisabled, statusText }) => {
  return (
    <Box
      borderStyle="round"
      borderColor={isDisabled ? "gray" : "blue"}
      paddingX={1}
      marginTop={1}
    >
      <Text bold color="blue">&gt; </Text>
      <TextInput
        placeholder="Message or /command..."
        onSubmit={onSubmit}
        isDisabled={isDisabled}
        suggestions={COMMANDS}
      />
      {statusText && (
        <Text dimColor> {statusText}</Text>
      )}
    </Box>
  );
};
```

- [ ] **Step 2: Verify build**

```bash
cd packages/agent-mux-mcp && npm run build
```

Expected: Clean compile.

- [ ] **Step 3: Commit**

```bash
git add packages/agent-mux-mcp/src/cli/ink/components/InputBar.tsx
git commit -m "feat(tui): InputBar component with slash command autocomplete"
```

---

### Task 8: Message components (UserMessage, AssistantMessage, RoutingBadge)

**Files:**
- Create: `packages/agent-mux-mcp/src/cli/ink/components/UserMessage.tsx`
- Create: `packages/agent-mux-mcp/src/cli/ink/components/AssistantMessage.tsx`
- Create: `packages/agent-mux-mcp/src/cli/ink/components/RoutingBadge.tsx`

- [ ] **Step 1: Create UserMessage**

Create `packages/agent-mux-mcp/src/cli/ink/components/UserMessage.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";

interface UserMessageProps {
  content: string;
}

export const UserMessage: React.FC<UserMessageProps> = ({ content }) => (
  <Box flexDirection="column" paddingX={1} marginTop={1}>
    <Text bold color="cyan">You</Text>
    <Text>{content}</Text>
  </Box>
);
```

- [ ] **Step 2: Create RoutingBadge**

Create `packages/agent-mux-mcp/src/cli/ink/components/RoutingBadge.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";
import type { RouteResult } from "../../../core/events.js";

interface RoutingBadgeProps {
  decision: RouteResult;
}

export const RoutingBadge: React.FC<RoutingBadgeProps> = ({ decision }) => {
  const color = decision.target === "claude" ? "blue" : "green";
  const name = decision.target === "claude" ? "Claude" : "Codex";
  const conf = Math.round(decision.confidence * 100);

  return (
    <Box paddingX={1}>
      <Text dimColor>{"\u2192"} </Text>
      <Text bold color={color}>{name}</Text>
      <Text dimColor>  {decision.reason}  {conf}%</Text>
    </Box>
  );
};
```

- [ ] **Step 3: Create AssistantMessage with markdown rendering**

Create `packages/agent-mux-mcp/src/cli/ink/components/AssistantMessage.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

// Configure marked once
marked.use(markedTerminal({
  width: 80,
  reflowText: false,
  showSectionPrefix: false,
  tab: 2,
}));

interface AssistantMessageProps {
  content: string;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({ content }) => {
  let rendered: string;
  try {
    rendered = marked.parse(content) as string;
    // Strip trailing newlines from marked output
    rendered = rendered.replace(/\n+$/, "");
  } catch {
    rendered = content;
  }

  return (
    <Box flexDirection="column" paddingX={1} marginTop={1}>
      <Text bold color="green">Assistant</Text>
      <Text>{rendered}</Text>
    </Box>
  );
};
```

- [ ] **Step 4: Verify build**

```bash
cd packages/agent-mux-mcp && npm run build
```

Expected: Clean compile.

- [ ] **Step 5: Commit**

```bash
git add packages/agent-mux-mcp/src/cli/ink/components/UserMessage.tsx packages/agent-mux-mcp/src/cli/ink/components/AssistantMessage.tsx packages/agent-mux-mcp/src/cli/ink/components/RoutingBadge.tsx
git commit -m "feat(tui): UserMessage, AssistantMessage, RoutingBadge components"
```

---

### Task 9: ToolUseBlock, ThinkingBlock, DiffPreview components

**Files:**
- Create: `packages/agent-mux-mcp/src/cli/ink/components/ToolUseBlock.tsx`
- Create: `packages/agent-mux-mcp/src/cli/ink/components/ThinkingBlock.tsx`
- Create: `packages/agent-mux-mcp/src/cli/ink/components/DiffPreview.tsx`

- [ ] **Step 1: Create ToolUseBlock (collapsible)**

Create `packages/agent-mux-mcp/src/cli/ink/components/ToolUseBlock.tsx`:

```tsx
import React, { useState } from "react";
import { Box, Text, useInput, useFocus } from "ink";

interface ToolUseBlockProps {
  tool: string;
  input: Record<string, unknown>;
  output?: string;
}

export const ToolUseBlock: React.FC<ToolUseBlockProps> = ({ tool, input, output }) => {
  const [expanded, setExpanded] = useState(false);
  const { isFocused } = useFocus();

  useInput((_input, key) => {
    if (isFocused && key.return) {
      setExpanded((prev) => !prev);
    }
  });

  const summary = Object.values(input).map(String).join(", ").slice(0, 50);
  const arrow = expanded ? "\u25BC" : "\u25B6";
  const borderColor = isFocused ? "cyan" : "gray";

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text>
        <Text color={borderColor}>{arrow} </Text>
        <Text dimColor>{tool}</Text>
        <Text dimColor> {summary}</Text>
      </Text>
      {expanded && output && (
        <Box paddingLeft={2} marginTop={0}>
          <Text dimColor>{output.slice(0, 500)}</Text>
        </Box>
      )}
    </Box>
  );
};
```

- [ ] **Step 2: Create ThinkingBlock (collapsible)**

Create `packages/agent-mux-mcp/src/cli/ink/components/ThinkingBlock.tsx`:

```tsx
import React, { useState } from "react";
import { Box, Text, useInput, useFocus } from "ink";

interface ThinkingBlockProps {
  content: string;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ content }) => {
  const [expanded, setExpanded] = useState(false);
  const { isFocused } = useFocus();

  useInput((_input, key) => {
    if (isFocused && key.return) {
      setExpanded((prev) => !prev);
    }
  });

  const arrow = expanded ? "\u25BC" : "\u25B6";
  const borderColor = isFocused ? "cyan" : "gray";
  const preview = content.slice(0, 60).replace(/\n/g, " ");

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text>
        <Text color={borderColor}>{arrow} </Text>
        <Text italic dimColor>Thinking{expanded ? "" : `: ${preview}...`}</Text>
      </Text>
      {expanded && (
        <Box paddingLeft={2}>
          <Text italic dimColor>{content}</Text>
        </Box>
      )}
    </Box>
  );
};
```

- [ ] **Step 3: Create DiffPreview**

Create `packages/agent-mux-mcp/src/cli/ink/components/DiffPreview.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";

interface DiffPreviewProps {
  patch: string;
  files: string[];
  maxLines?: number;
}

function colorLine(line: string): React.ReactNode {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return <Text color="green">{line}</Text>;
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return <Text color="red">{line}</Text>;
  }
  if (line.startsWith("@@")) {
    return <Text color="cyan">{line}</Text>;
  }
  return <Text dimColor>{line}</Text>;
}

export const DiffPreview: React.FC<DiffPreviewProps> = ({ patch, files, maxLines = 30 }) => {
  const lines = patch.split("\n").slice(0, maxLines);
  const fileList = files.join(", ");

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      marginLeft={2}
      marginTop={1}
    >
      <Text dimColor>Diff: {fileList}</Text>
      {lines.map((line, i) => (
        <Text key={i}>{colorLine(line)}</Text>
      ))}
      {patch.split("\n").length > maxLines && (
        <Text dimColor>({patch.split("\n").length - maxLines} more lines)</Text>
      )}
    </Box>
  );
};
```

- [ ] **Step 4: Verify build**

```bash
cd packages/agent-mux-mcp && npm run build
```

Expected: Clean compile.

- [ ] **Step 5: Commit**

```bash
git add packages/agent-mux-mcp/src/cli/ink/components/ToolUseBlock.tsx packages/agent-mux-mcp/src/cli/ink/components/ThinkingBlock.tsx packages/agent-mux-mcp/src/cli/ink/components/DiffPreview.tsx
git commit -m "feat(tui): ToolUseBlock, ThinkingBlock, DiffPreview components"
```

---

## Chunk 4: Ink TUI — Hooks, Streaming, and Full App

### Task 10: React hooks (useEngine, useMessages, useBudget)

**Files:**
- Create: `packages/agent-mux-mcp/src/cli/ink/hooks/useEngine.ts`
- Create: `packages/agent-mux-mcp/src/cli/ink/hooks/useMessages.ts`
- Create: `packages/agent-mux-mcp/src/cli/ink/hooks/useBudget.ts`

- [ ] **Step 1: Create useEngine hook**

Create `packages/agent-mux-mcp/src/cli/ink/hooks/useEngine.ts`:

```typescript
import { useState, useEffect } from "react";
import { createEngine } from "../../../core/engine.js";
import type { MuxEngine } from "../../../core/engine.js";

export function useEngine(): MuxEngine | null {
  const [engine, setEngine] = useState<MuxEngine | null>(null);

  useEffect(() => {
    createEngine().then(setEngine);
  }, []);

  return engine;
}
```

- [ ] **Step 2: Create useMessages hook**

Create `packages/agent-mux-mcp/src/cli/ink/hooks/useMessages.ts`:

```typescript
import { useState, useCallback, useRef, useEffect } from "react";
import type { MuxEvent, RouteResult } from "../../../core/events.js";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  routing?: RouteResult;
  toolUses?: Array<{ tool: string; input: Record<string, unknown>; output?: string }>;
  thinkingBlocks?: string[];
  diff?: { patch: string; files: string[] };
  confirm?: { id: string; prompt: string; options: string[] };
}

export type AppState = "idle" | "streaming" | "confirming";

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [currentMessage, setCurrentMessage] = useState<Partial<Message>>({});
  const [appState, setAppState] = useState<AppState>("idle");

  // Use refs to avoid stale closures in handleEvent
  const streamBufferRef = useRef("");
  const currentMessageRef = useRef<Partial<Message>>({});

  // Keep refs in sync with state
  useEffect(() => { streamBufferRef.current = streamBuffer; }, [streamBuffer]);
  useEffect(() => { currentMessageRef.current = currentMessage; }, [currentMessage]);

  const addUserMessage = useCallback((content: string) => {
    setMessages((prev) => [...prev, {
      id: `user-${Date.now()}`,
      role: "user",
      content,
    }]);
  }, []);

  const handleEvent = useCallback((event: MuxEvent) => {
    switch (event.type) {
      case "routing":
        setCurrentMessage((prev) => ({ ...prev, routing: event.decision }));
        break;
      case "stream":
        setStreamBuffer((prev) => prev + event.chunk);
        setAppState("streaming");
        break;
      case "thinking":
        setCurrentMessage((prev) => ({
          ...prev,
          thinkingBlocks: [...(prev.thinkingBlocks ?? []), event.content],
        }));
        break;
      case "tool_use":
        setCurrentMessage((prev) => ({
          ...prev,
          toolUses: [...(prev.toolUses ?? []), { tool: event.tool, input: event.input }],
        }));
        break;
      case "tool_result": {
        setCurrentMessage((prev) => {
          const tools = [...(prev.toolUses ?? [])];
          if (tools.length > 0) {
            tools[tools.length - 1].output = event.output;
          }
          return { ...prev, toolUses: tools };
        });
        break;
      }
      case "diff":
        setCurrentMessage((prev) => ({
          ...prev,
          diff: { patch: event.patch, files: event.files },
        }));
        break;
      case "file_list":
        setCurrentMessage((prev) => ({
          ...prev,
          fileList: { files: event.files, additions: event.additions, deletions: event.deletions },
        }));
        break;
      case "confirm":
        setCurrentMessage((prev) => ({
          ...prev,
          confirm: { id: event.id, prompt: event.prompt, options: event.options },
        }));
        setAppState("confirming");
        break;
      case "progress":
        // Update spinner label
        setCurrentMessage((prev) => ({ ...prev, progressText: event.message }));
        break;
      case "error":
        setMessages((prev) => [...prev, {
          id: `error-${Date.now()}`,
          role: "system",
          content: event.message,
        }]);
        break;
      case "done":
        // Use refs to get latest values (avoids stale closure)
        setMessages((prev) => [...prev, {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: streamBufferRef.current,
          ...currentMessageRef.current,
        }]);
        setStreamBuffer("");
        streamBufferRef.current = "";
        setCurrentMessage({});
        currentMessageRef.current = {};
        setAppState("idle");
        break;
      case "budget_update":
        // Handled by useBudget hook
        break;
    }
  }, []); // No dependencies needed — uses refs for mutable state

  const reset = useCallback(() => {
    setStreamBuffer("");
    setCurrentMessage({});
    setAppState("idle");
  }, []);

  return {
    messages,
    streamBuffer,
    currentMessage,
    appState,
    addUserMessage,
    handleEvent,
    reset,
  };
}
```

- [ ] **Step 3: Create useBudget hook**

Create `packages/agent-mux-mcp/src/cli/ink/hooks/useBudget.ts`:

```typescript
import { useState, useEffect, useCallback } from "react";
import type { BudgetStatus } from "../../../types.js";
import type { MuxEngine } from "../../../core/engine.js";
import type { MuxEvent } from "../../../core/events.js";

export function useBudget(engine: MuxEngine | null) {
  const [budget, setBudget] = useState<BudgetStatus | null>(null);

  // Initial load + periodic refresh
  useEffect(() => {
    if (!engine) return;
    engine.getBudget().then(setBudget);

    const interval = setInterval(() => {
      engine.getBudget().then(setBudget);
    }, 30_000);

    return () => clearInterval(interval);
  }, [engine]);

  // Handle budget_update events from engine
  const handleBudgetEvent = useCallback((event: MuxEvent) => {
    if (event.type === "budget_update") {
      setBudget(event.budget);
    }
  }, []);

  return { budget, handleBudgetEvent };
}
```

- [ ] **Step 4: Verify build**

```bash
cd packages/agent-mux-mcp && npm run build
```

Expected: Clean compile.

- [ ] **Step 5: Commit**

```bash
git add packages/agent-mux-mcp/src/cli/ink/hooks/
git commit -m "feat(tui): useEngine, useMessages, useBudget hooks"
```

---

### Task 11: StreamingArea + Spinner

**Files:**
- Create: `packages/agent-mux-mcp/src/cli/ink/components/StreamingArea.tsx`
- Create: `packages/agent-mux-mcp/src/cli/ink/components/MuxSpinner.tsx`

- [ ] **Step 1: Create MuxSpinner**

Create `packages/agent-mux-mcp/src/cli/ink/components/MuxSpinner.tsx`:

```tsx
import React, { useState, useEffect } from "react";
import { Text } from "ink";

const BRAILLE = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];

interface MuxSpinnerProps {
  label?: string;
}

export const MuxSpinner: React.FC<MuxSpinnerProps> = ({ label }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % BRAILLE.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text dimColor>
      {BRAILLE[frame]} {label ?? "thinking..."}
    </Text>
  );
};
```

- [ ] **Step 2: Create StreamingArea**

Create `packages/agent-mux-mcp/src/cli/ink/components/StreamingArea.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { MuxSpinner } from "./MuxSpinner.js";
import { ToolUseBlock } from "./ToolUseBlock.js";
import { ThinkingBlock } from "./ThinkingBlock.js";
import { RoutingBadge } from "./RoutingBadge.js";
import type { Message, AppState } from "../hooks/useMessages.js";
import type { RouteResult } from "../../../core/events.js";

marked.use(markedTerminal({ width: 80, reflowText: false, tab: 2 }));

interface StreamingAreaProps {
  streamBuffer: string;
  currentMessage: Partial<Message>;
  appState: AppState;
}

export const StreamingArea: React.FC<StreamingAreaProps> = ({
  streamBuffer,
  currentMessage,
  appState,
}) => {
  if (appState === "idle") return null;

  let renderedMarkdown = streamBuffer;
  try {
    if (streamBuffer) {
      renderedMarkdown = (marked.parse(streamBuffer) as string).replace(/\n+$/, "");
    }
  } catch {
    // fallback to raw text
  }

  return (
    <Box flexDirection="column" paddingX={1} marginTop={1}>
      {currentMessage.routing && (
        <RoutingBadge decision={currentMessage.routing} />
      )}

      <Text bold color="green">Assistant</Text>

      {/* Thinking blocks */}
      {currentMessage.thinkingBlocks?.map((block, i) => (
        <ThinkingBlock key={`think-${i}`} content={block} />
      ))}

      {/* Tool uses */}
      {currentMessage.toolUses?.map((tu, i) => (
        <ToolUseBlock key={`tool-${i}`} tool={tu.tool} input={tu.input} output={tu.output} />
      ))}

      {/* Streamed content */}
      {streamBuffer && <Text>{renderedMarkdown}</Text>}

      {/* Spinner while streaming */}
      {appState === "streaming" && !streamBuffer && (
        <MuxSpinner />
      )}

      {/* Confirmation prompt */}
      {appState === "confirming" && currentMessage.confirm && (
        <Box marginTop={1}>
          <Text bold color="yellow">{currentMessage.confirm.prompt}</Text>
        </Box>
      )}
    </Box>
  );
};
```

- [ ] **Step 3: Verify build**

```bash
cd packages/agent-mux-mcp && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/agent-mux-mcp/src/cli/ink/components/StreamingArea.tsx packages/agent-mux-mcp/src/cli/ink/components/MuxSpinner.tsx
git commit -m "feat(tui): StreamingArea and MuxSpinner components"
```

---

### Task 12: Complete App.tsx with full interaction loop

**Files:**
- Modify: `packages/agent-mux-mcp/src/cli/ink/App.tsx`

- [ ] **Step 1: Rewrite App.tsx with full message loop**

Replace `packages/agent-mux-mcp/src/cli/ink/App.tsx` with:

```tsx
import React, { useCallback } from "react";
import { Box, Text, Static, useApp, useInput } from "ink";
import { Header } from "./components/Header.js";
import { UserMessage } from "./components/UserMessage.js";
import { AssistantMessage } from "./components/AssistantMessage.js";
import { RoutingBadge } from "./components/RoutingBadge.js";
import { ToolUseBlock } from "./components/ToolUseBlock.js";
import { ThinkingBlock } from "./components/ThinkingBlock.js";
import { DiffPreview } from "./components/DiffPreview.js";
import { StreamingArea } from "./components/StreamingArea.js";
import { InputBar } from "./components/InputBar.js";
import { useEngine } from "./hooks/useEngine.js";
import { useMessages } from "./hooks/useMessages.js";
import { useBudget } from "./hooks/useBudget.js";
import type { Message } from "./hooks/useMessages.js";
import type { MuxEvent } from "../../core/events.js";

// Track double Ctrl+C
let lastCtrlC = 0;

export const App: React.FC = () => {
  const { exit } = useApp();
  const engine = useEngine();
  const { budget, handleBudgetEvent } = useBudget(engine);
  const {
    messages,
    streamBuffer,
    currentMessage,
    appState,
    addUserMessage,
    handleEvent,
    reset,
  } = useMessages();

  // Ctrl+C handling
  useInput((_input, key) => {
    if (key.ctrl && _input === "c") {
      const now = Date.now();
      if (now - lastCtrlC < 500) {
        exit();
        return;
      }
      lastCtrlC = now;

      if (appState !== "idle" && engine) {
        engine.cancel();
        reset();
      } else {
        // Idle: show hint
        handleEvent({ type: "error", message: "Use /quit to exit. Double Ctrl+C to force exit.", recoverable: true });
      }
    }
  });

  const handleSubmit = useCallback(async (input: string) => {
    if (!engine || !input.trim()) return;

    // Slash commands
    if (input === "/quit" || input === "/q") {
      exit();
      return;
    }
    if (input === "/help") {
      addUserMessage(input);
      handleEvent({ type: "stream", chunk: helpText() });
      handleEvent({ type: "done", summary: "help" });
      return;
    }
    if (input === "/status") {
      const b = await engine.getBudget();
      const c = await engine.getConfig();
      const statusText = `**Budget:** Claude ${Math.round(b.claude.usagePercent)}% | Codex ${Math.round(b.codex.usagePercent)}%\n**Tier:** ${c.tier} | **Engine:** ${c.routing.engine}`;
      addUserMessage(input);
      handleEvent({ type: "stream", chunk: statusText });
      handleEvent({ type: "done", summary: "status" });
      return;
    }
    if (input === "/history") {
      const history = await engine.getHistory(10);
      const lines = history.length === 0
        ? "No routing history yet."
        : history.map(h => {
            const t = h.decision.target === "claude" ? "Claude" : "Codex";
            const conf = Math.round(h.decision.confidence * 100);
            return `${new Date(h.timestamp).toLocaleTimeString()}  ${t}  ${conf}%  ${h.taskSummary.slice(0, 40)}`;
          }).join("\n");
      addUserMessage(input);
      handleEvent({ type: "stream", chunk: lines });
      handleEvent({ type: "done", summary: "history" });
      return;
    }
    if (input === "/why") {
      const history = await engine.getHistory(1);
      if (history.length === 0) {
        addUserMessage(input);
        handleEvent({ type: "stream", chunk: "No routing decisions yet." });
        handleEvent({ type: "done", summary: "why" });
      } else {
        const last = history[0];
        const text = `**Target:** ${last.decision.target}\n**Confidence:** ${Math.round(last.decision.confidence * 100)}%\n**Reason:** ${last.decision.reason}`;
        addUserMessage(input);
        handleEvent({ type: "stream", chunk: text });
        handleEvent({ type: "done", summary: "why" });
      }
      return;
    }
    if (input === "/config") {
      const c = await engine.getConfig();
      addUserMessage(input);
      handleEvent({ type: "stream", chunk: "```json\n" + JSON.stringify(c, null, 2) + "\n```" });
      handleEvent({ type: "done", summary: "config" });
      return;
    }
    if (input.startsWith("/go ")) {
      const task = input.slice(4).trim();
      if (task) {
        addUserMessage(input);
        const decomposition = await engine.decompose(task);
        if (decomposition.shouldDecompose) {
          const subtaskList = decomposition.subtasks.map((s, i) => `${i + 1}. ${s.description}`).join("\n");
          handleEvent({ type: "stream", chunk: `**Decomposed into ${decomposition.subtasks.length} subtasks:**\n${subtaskList}\n\nExecuting...` });
        }
        for await (const event of engine.executeDecomposed(decomposition)) {
          handleEvent(event);
          handleBudgetEvent(event);
        }
      }
      return;
    }

    addUserMessage(input);

    try {
      if (engine.isCodingTask(input) && !input.startsWith("/chat ")) {
        // Coding task: route then execute
        const decision = await engine.analyzeAndRoute(input);
        handleEvent({ type: "routing", decision });

        for await (const event of engine.execute(input, decision)) {
          handleEvent(event);
          handleBudgetEvent(event);
        }
      } else {
        // Chat mode
        const chatInput = input.startsWith("/chat ") ? input.slice(6) : input;
        for await (const event of engine.chat(chatInput)) {
          handleEvent(event);
          handleBudgetEvent(event);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      handleEvent({ type: "error", message: msg, recoverable: true });
      handleEvent({ type: "done", summary: "error" });
    }
  }, [engine, appState, handleEvent, handleBudgetEvent, addUserMessage, reset, exit]);

  // Confirmation response
  const handleConfirmResponse = useCallback((choice: string) => {
    if (!engine || !currentMessage.confirm) return;
    engine.respondToConfirm(currentMessage.confirm.id, choice);
  }, [engine, currentMessage]);

  // Load config on mount
  const [config, setConfig] = useState<any>(null);
  React.useEffect(() => {
    if (engine) engine.getConfig().then(setConfig);
  }, [engine]);

  if (!engine || !budget || !config) {
    return <Text dimColor>Loading engine...</Text>;
  }

  return (
    <Box flexDirection="column">
      {/* Terminal width check */}
      {(process.stdout.columns || 80) < 60 && (
        <Text color="yellow">Warning: terminal width &lt; 60 columns — layout may be degraded</Text>
      )}

      {/* Header — always visible */}
      <Header
        version={engine.getVersion()}
        config={config}
        budget={budget as any}
      />

      {/* Static message history */}
      <Static items={messages}>
        {(msg: Message) => (
          <Box key={msg.id} flexDirection="column">
            {msg.role === "user" && <UserMessage content={msg.content} />}
            {msg.role === "assistant" && (
              <>
                {msg.routing && <RoutingBadge decision={msg.routing} />}
                {msg.thinkingBlocks?.map((block, i) => (
                  <ThinkingBlock key={`${msg.id}-think-${i}`} content={block} />
                ))}
                {msg.toolUses?.map((tu, i) => (
                  <ToolUseBlock key={`${msg.id}-tool-${i}`} tool={tu.tool} input={tu.input} output={tu.output} />
                ))}
                <AssistantMessage content={msg.content} />
                {msg.diff && <DiffPreview patch={msg.diff.patch} files={msg.diff.files} />}
              </>
            )}
            {msg.role === "system" && (
              <Box paddingX={1}>
                <Text color="red">{msg.content}</Text>
              </Box>
            )}
          </Box>
        )}
      </Static>

      {/* Active streaming area */}
      <StreamingArea
        streamBuffer={streamBuffer}
        currentMessage={currentMessage}
        appState={appState}
      />

      {/* Input bar */}
      <InputBar
        onSubmit={appState === "confirming" ? handleConfirmResponse : handleSubmit}
        isDisabled={appState === "streaming"}
        statusText={appState === "streaming" ? "streaming..." : undefined}
      />
    </Box>
  );
};

function helpText(): string {
  return [
    "**Commands:**",
    "- `<task>` — Route and execute a coding task",
    "- `/chat <msg>` — General chat (skip routing)",
    "- `/go <task>` — Auto-decompose and execute",
    "- `/status` — Show budget details",
    "- `/history` — Recent routing decisions",
    "- `/why` — Explain last routing decision",
    "- `/config` — Show configuration",
    "- `/help` — This help",
    "- `/quit` — Exit",
    "",
    "Ctrl+C cancels current task. Double Ctrl+C exits.",
  ].join("\n");
}
```

- [ ] **Step 2: Verify build**

```bash
cd packages/agent-mux-mcp && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add packages/agent-mux-mcp/src/cli/ink/App.tsx
git commit -m "feat(tui): complete App with message loop, streaming, and Ctrl+C handling"
```

---

## Chunk 5: CLI Wiring and Integration

### Task 13: Wire Ink app into CLI entry point

**Files:**
- Modify: `packages/agent-mux-mcp/src/cli/index.ts`
- Create: `packages/agent-mux-mcp/src/cli/ink/render.tsx`

- [ ] **Step 1: Create render entry point**

Create `packages/agent-mux-mcp/src/cli/ink/render.tsx`:

```tsx
import React from "react";
import { render } from "ink";
import { App } from "./App.js";

export async function startInkRepl(): Promise<void> {
  const instance = render(<App />, {
    exitOnCtrlC: false,  // We handle Ctrl+C ourselves
    patchConsole: true,   // Capture console.log so it doesn't break layout
  });

  await instance.waitUntilExit();
}
```

- [ ] **Step 2: Modify index.ts default action**

In `packages/agent-mux-mcp/src/cli/index.ts`, find the default REPL action (the code that calls `startRepl()`) and add the `--legacy` flag:

Add `--legacy` option to the program:
```typescript
program.option('--legacy', 'Use legacy readline REPL instead of Ink TUI');
```

Change the default action that calls `startRepl()` to:
```typescript
// In the default action (no subcommand):
if (opts.legacy || !process.stdin.isTTY) {
  const { startRepl } = await import('./repl.js');
  await startRepl();
} else {
  const { startInkRepl } = await import('./ink/render.js');
  await startInkRepl();
}
```

- [ ] **Step 3: Verify build**

```bash
cd packages/agent-mux-mcp && npm run build
```

- [ ] **Step 4: Verify existing tests still pass**

```bash
cd packages/agent-mux-mcp && npm test
```

- [ ] **Step 5: Manual smoke test**

```bash
cd packages/agent-mux-mcp && node dist/bin/cli.js
```

Expected: Ink TUI launches with Header showing budget, input bar at bottom.

```bash
cd packages/agent-mux-mcp && node dist/bin/cli.js --legacy
```

Expected: Old readline REPL launches.

- [ ] **Step 6: Commit**

```bash
git add packages/agent-mux-mcp/src/cli/ink/render.tsx packages/agent-mux-mcp/src/cli/index.ts
git commit -m "feat(tui): wire Ink TUI as default REPL with --legacy fallback"
```

---

### Task 14: Korean IME spike test

**Files:**
- No permanent files — this is a validation step

- [ ] **Step 1: Test Korean input in Ink TUI**

```bash
cd packages/agent-mux-mcp && node dist/bin/cli.js
```

Type Korean text: `안녕하세요`, `리팩토링해줘`, `버그 수정해줘`

Check:
- Characters compose correctly (ㅎ → 하 → 한 without interruption)
- Backspace works within composed characters
- Submitted text matches what was typed

- [ ] **Step 2: If Korean IME breaks — document and create fallback ticket**

If composition is broken, add a note to the spec and fall back to readline-based input wrapper. This is a known risk documented in the spec.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix(tui): Korean IME compatibility adjustments"
```

---

### Task 15: Full integration test

**Files:**
- No new files — validation of end-to-end flow

- [ ] **Step 1: Run full test suite**

```bash
cd packages/agent-mux-mcp && npm test
```

Expected: All tests pass (existing 236 + new core engine tests).

- [ ] **Step 2: Build clean**

```bash
cd packages/agent-mux-mcp && npm run build
```

Expected: Zero errors.

- [ ] **Step 3: E2E smoke test — chat flow**

```bash
cd packages/agent-mux-mcp && echo "hello" | node dist/bin/cli.js --legacy
```

Expected: Routes to Claude as general chat, returns response.

- [ ] **Step 4: E2E smoke test — coding task**

```bash
cd packages/agent-mux-mcp && echo "fix the auth bug" | node dist/bin/cli.js --legacy
```

Expected: Analyzes signals, routes to Claude or Codex, shows response.

- [ ] **Step 5: Version bump and final commit**

Update `package.json` version to `0.10.0`:

```bash
cd packages/agent-mux-mcp && npm version minor --no-git-tag-version
git add -A && git commit -m "feat: v0.10.0 — Ink TUI with Core Engine API"
```
