/**
 * Claude CLI Streaming Adapter
 * Spawns `claude -p <prompt> --output-format stream-json`, reads JSONL lines,
 * and yields MuxEvent objects. Falls back to plain text if JSON parse fails.
 * Detects auth errors early.
 */

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { registerProcess, unregisterProcess } from '../cli/process-tracker.js';
import { debug } from '../cli/debug.js';
import { CLAUDE_TIMEOUT_DEFAULT } from '../constants.js';
import type { MuxEvent } from './events.js';

// ─── Claude stream-json event shapes ────────────────────────────────

interface ClaudeStreamEvent {
  type: string;
  // assistant message delta
  delta?: {
    type?: string;
    text?: string;
    thinking?: string;
    partial_json?: string;
  };
  // tool use
  name?: string;
  input?: Record<string, unknown>;
  // tool result
  content?: string | Array<{ type: string; text?: string }>;
  // usage
  usage?: { input_tokens?: number; output_tokens?: number };
  // error
  error?: { message?: string; type?: string };
  // message start/stop
  message?: {
    role?: string;
    content?: Array<{ type: string; text?: string; thinking?: string }>;
  };
}

// ─── Event Parser ────────────────────────────────────────────────────

/**
 * Map a single Claude stream-json event object to a MuxEvent (or null to skip).
 */
export function parseClaudeStreamEvent(event: ClaudeStreamEvent): MuxEvent | null {
  const { type } = event;

  switch (type) {
    case 'content_block_delta': {
      const delta = event.delta;
      if (!delta) return null;
      if (delta.type === 'text_delta' && typeof delta.text === 'string') {
        return { type: 'stream', chunk: delta.text };
      }
      if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
        return { type: 'thinking', content: delta.thinking };
      }
      return null;
    }

    case 'tool_use': {
      const toolName = typeof event.name === 'string' ? event.name : 'unknown';
      const toolInput = (event.input as Record<string, unknown>) ?? {};
      return { type: 'tool_use', tool: toolName, input: toolInput };
    }

    case 'tool_result': {
      let output = '';
      if (typeof event.content === 'string') {
        output = event.content;
      } else if (Array.isArray(event.content)) {
        output = event.content
          .filter(c => c.type === 'text')
          .map(c => c.text ?? '')
          .join('');
      }
      return { type: 'tool_result', output };
    }

    case 'message_stop':
    case 'message_delta': {
      // Completion event — emit done with empty summary (caller fills it in)
      if (type === 'message_stop') {
        return { type: 'done', summary: '' };
      }
      return null;
    }

    case 'error': {
      const msg = event.error?.message ?? event.error?.type ?? 'Unknown Claude error';
      return { type: 'error', message: msg, recoverable: false };
    }

    default:
      return null;
  }
}

// ─── Stream Claude ───────────────────────────────────────────────────

export interface StreamClaudeOptions {
  timeout?: number;
  model?: string;
}

/**
 * Spawn `claude -p <prompt> --output-format stream-json` and yield MuxEvent objects.
 * Reads stdout line by line via readline, parses JSONL.
 * Falls back to plain text chunks if JSON parse fails.
 * Yields an `error` event early if auth issues are detected on stderr.
 */
export async function* streamClaude(
  prompt: string,
  opts?: StreamClaudeOptions,
): AsyncGenerator<MuxEvent> {
  const args = ['-p', prompt, '--output-format', 'stream-json'];
  if (opts?.model) {
    args.push('--model', opts.model);
  }

  debug('streamClaude: spawning claude', args.slice(0, 4));

  const proc = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  registerProcess(proc);

  const startedAt = Date.now();
  const timeout = setTimeout(() => {
    debug('streamClaude: timeout, killing process');
    proc.kill('SIGTERM');
  }, opts?.timeout ?? CLAUDE_TIMEOUT_DEFAULT);

  // Accumulate stderr for error reporting
  let stderrBuf = '';
  proc.stderr.on('data', (chunk: Buffer) => {
    stderrBuf += chunk.toString();
  });

  // We use a queue + signal approach so we can yield from inside event callbacks
  const events: MuxEvent[] = [];
  let finished = false;
  let resolveNext: (() => void) | null = null;

  function push(ev: MuxEvent): void {
    events.push(ev);
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r();
    }
  }

  function waitForMore(): Promise<void> {
    return new Promise(resolve => {
      resolveNext = resolve;
    });
  }

  // Readline over stdout
  const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });

  rl.on('line', (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Try JSON parse
    try {
      const ev = JSON.parse(trimmed) as ClaudeStreamEvent;
      const muxEv = parseClaudeStreamEvent(ev);
      if (muxEv) push(muxEv);
    } catch {
      // Fallback: emit as plain text stream chunk
      push({ type: 'stream', chunk: trimmed + '\n' });
    }
  });

  proc.on('error', (err: NodeJS.ErrnoException) => {
    clearTimeout(timeout);
    unregisterProcess(proc);
    if (err.code === 'ENOENT') {
      push({
        type: 'error',
        message: 'Claude CLI not found. Install: npm install -g @anthropic-ai/claude-code',
        recoverable: false,
      });
    } else {
      push({ type: 'error', message: err.message, recoverable: false });
    }
    finished = true;
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(); }
  });

  proc.on('close', (code) => {
    clearTimeout(timeout);
    unregisterProcess(proc);

    // Check stderr for auth errors
    if (stderrBuf) {
      const lower = stderrBuf.toLowerCase();
      if (lower.includes('authentication') || lower.includes('unauthorized') || lower.includes('api key')) {
        push({ type: 'error', message: `Auth error: ${stderrBuf.slice(0, 200)}`, recoverable: false });
      } else if (code !== 0) {
        push({ type: 'error', message: `Claude exited with code ${code}: ${stderrBuf.slice(0, 200)}`, recoverable: false });
      }
    } else if (code !== 0) {
      push({ type: 'error', message: `Claude exited with code ${code}`, recoverable: false });
    }

    // Ensure done event is emitted if not already
    const hasDone = events.some(e => e.type === 'done');
    if (!hasDone && code === 0) {
      push({ type: 'done', summary: '' });
    }

    finished = true;
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(); }
  });

  // Drain the queue
  while (true) {
    // Yield any queued events
    while (events.length > 0) {
      const ev = events.shift()!;
      yield ev;
      if (ev.type === 'done' || ev.type === 'error') return;
    }

    if (finished) break;

    // Wait for more
    await waitForMore();
  }

  // Yield any remaining events
  while (events.length > 0) {
    const ev = events.shift()!;
    yield ev;
    if (ev.type === 'done' || ev.type === 'error') return;
  }
}

// ─── Stream Chat (lightweight haiku mode) ───────────────────────────

const CHAT_TIMEOUT = 60_000;
const CHAT_MODEL = 'claude-haiku-4-5';

/**
 * Lightweight chat wrapper — uses haiku model with 60s timeout.
 * Suitable for quick conversational responses.
 */
export async function* streamChat(message: string): AsyncGenerator<MuxEvent> {
  yield* streamClaude(message, {
    model: CHAT_MODEL,
    timeout: CHAT_TIMEOUT,
  });
}
