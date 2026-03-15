/**
 * Codex JSONL Event Parser
 * Parses JSONL streaming output from `codex exec --json` into structured events.
 */

import type { JsonlEventType, JsonlEvent } from '../types.js';
import { STALL_THRESHOLD } from '../constants.js';

// Re-export types for convenience
export type { JsonlEventType, JsonlEvent };

// ─── Single Line Parser ─────────────────────────────────────────────

const VALID_EVENT_TYPES = new Set<string>([
  'thread.started',
  'turn.started',
  'turn.completed',
  'item.started',
  'item.completed',
]);

/**
 * Parse a single JSONL line into a JsonlEvent.
 * Returns null if the line is empty, not valid JSON, or not a recognized event type.
 */
export function parseJsonlLine(line: string): JsonlEvent | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;

  const type = parsed.type as string | undefined;
  if (!type || !VALID_EVENT_TYPES.has(type)) return null;

  const event: JsonlEvent = {
    type: type as JsonlEventType,
  };

  // Extract item data
  if (parsed.item && typeof parsed.item === 'object') {
    const item = parsed.item as Record<string, unknown>;
    event.item = {
      type: typeof item.type === 'string' ? item.type : 'agent_message',
    };
    if (typeof item.content === 'string') event.item.content = item.content;
  }

  // Extract usage data
  if (parsed.usage && typeof parsed.usage === 'object') {
    const usage = parsed.usage as Record<string, unknown>;
    if (
      typeof usage.input_tokens === 'number' &&
      typeof usage.output_tokens === 'number'
    ) {
      event.usage = {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
      };
    }
  }

  return event;
}

// ─── Streaming Parser ───────────────────────────────────────────────

/**
 * Streaming JSONL parser that buffers incoming data and emits parsed events.
 * Includes stall detection for monitoring process health.
 */
export class JsonlStreamParser {
  private buffer = '';
  private events: JsonlEvent[] = [];
  private lastEventTime = Date.now();

  /**
   * Feed a chunk of data into the parser.
   * Returns an array of newly parsed events from this chunk.
   */
  feed(chunk: string): JsonlEvent[] {
    this.buffer += chunk;
    const newEvents: JsonlEvent[] = [];

    // Split on newlines — keep the last partial line in the buffer
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const event = parseJsonlLine(line);
      if (event) {
        this.events.push(event);
        newEvents.push(event);
        this.lastEventTime = Date.now();
      }
    }

    return newEvents;
  }

  /**
   * Check whether the parser has stalled (no events for longer than threshold).
   */
  isStalled(thresholdMs: number = STALL_THRESHOLD): boolean {
    return Date.now() - this.lastEventTime > thresholdMs;
  }

  /** Get the timestamp of the last successfully parsed event. */
  getLastEventTime(): number {
    return this.lastEventTime;
  }

  /** Get a copy of all parsed events so far. */
  getAllEvents(): JsonlEvent[] {
    return [...this.events];
  }
}

// ─── Diff Extraction Helpers ────────────────────────────────────────

/**
 * Extract a unified diff from Codex stdout.
 * Looks for diff markers (diff --git, ---, +++) in the output.
 */
export function extractDiff(stdout: string): string {
  const lines = stdout.split('\n');
  const diffLines: string[] = [];
  let inDiff = false;

  for (const line of lines) {
    if (line.startsWith('diff --git') || line.startsWith('--- ') || line.startsWith('+++ ')) {
      inDiff = true;
    }
    if (inDiff) {
      diffLines.push(line);
    }
  }

  return diffLines.join('\n');
}

/**
 * Extract modified file paths from a unified diff string.
 */
export function extractModifiedFiles(diff: string): string[] {
  const files = new Set<string>();
  const lines = diff.split('\n');

  for (const line of lines) {
    // Match +++ b/path/to/file
    const match = line.match(/^\+\+\+ b\/(.+)$/);
    if (match?.[1]) {
      files.add(match[1]);
    }
  }

  return [...files];
}
