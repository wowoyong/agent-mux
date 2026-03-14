import { describe, it, expect } from 'vitest';
import { parseJsonlLine, JsonlStreamParser, extractDiff, extractModifiedFiles } from './parser.js';

// ─── parseJsonlLine Tests ───────────────────────────────────────────

describe('parseJsonlLine', () => {
  it('parses a valid thread.started event', () => {
    const event = parseJsonlLine('{"type":"thread.started"}');
    expect(event).not.toBeNull();
    expect(event!.type).toBe('thread.started');
  });

  it('parses a valid turn.started event', () => {
    const event = parseJsonlLine('{"type":"turn.started"}');
    expect(event).not.toBeNull();
    expect(event!.type).toBe('turn.started');
  });

  it('parses a valid turn.completed event', () => {
    const event = parseJsonlLine('{"type":"turn.completed"}');
    expect(event).not.toBeNull();
    expect(event!.type).toBe('turn.completed');
  });

  it('parses item.started with item data', () => {
    const event = parseJsonlLine(JSON.stringify({
      type: 'item.started',
      item: { type: 'agent_message', content: 'Hello world' },
    }));
    expect(event).not.toBeNull();
    expect(event!.type).toBe('item.started');
    expect(event!.item).toBeDefined();
    expect(event!.item!.type).toBe('agent_message');
    expect(event!.item!.content).toBe('Hello world');
  });

  it('parses item.completed with usage data', () => {
    const event = parseJsonlLine(JSON.stringify({
      type: 'item.completed',
      usage: { input_tokens: 100, output_tokens: 50 },
    }));
    expect(event).not.toBeNull();
    expect(event!.usage).toBeDefined();
    expect(event!.usage!.input_tokens).toBe(100);
    expect(event!.usage!.output_tokens).toBe(50);
  });

  it('returns null for empty string', () => {
    expect(parseJsonlLine('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseJsonlLine('   \t  ')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseJsonlLine('not json at all')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseJsonlLine('{"type": "missing close')).toBeNull();
  });

  it('returns null for unrecognized event type', () => {
    expect(parseJsonlLine('{"type":"unknown.event"}')).toBeNull();
  });

  it('returns null for missing type field', () => {
    expect(parseJsonlLine('{"data":"no type"}')).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(parseJsonlLine('"just a string"')).toBeNull();
    expect(parseJsonlLine('42')).toBeNull();
    expect(parseJsonlLine('true')).toBeNull();
    expect(parseJsonlLine('null')).toBeNull();
  });

  it('defaults item type to agent_message when not a string', () => {
    const event = parseJsonlLine(JSON.stringify({
      type: 'item.started',
      item: { type: 123 },
    }));
    expect(event!.item!.type).toBe('agent_message');
  });

  it('ignores usage when tokens are not numbers', () => {
    const event = parseJsonlLine(JSON.stringify({
      type: 'item.completed',
      usage: { input_tokens: 'not a number', output_tokens: 50 },
    }));
    expect(event!.usage).toBeUndefined();
  });
});

// ─── JsonlStreamParser Tests ────────────────────────────────────────

describe('JsonlStreamParser', () => {
  it('parses complete lines from a single chunk', () => {
    const parser = new JsonlStreamParser();
    const events = parser.feed('{"type":"thread.started"}\n{"type":"turn.started"}\n');
    expect(events.length).toBe(2);
    expect(events[0]!.type).toBe('thread.started');
    expect(events[1]!.type).toBe('turn.started');
  });

  it('buffers partial lines across chunks', () => {
    const parser = new JsonlStreamParser();

    const events1 = parser.feed('{"type":"thr');
    expect(events1.length).toBe(0);

    const events2 = parser.feed('ead.started"}\n');
    expect(events2.length).toBe(1);
    expect(events2[0]!.type).toBe('thread.started');
  });

  it('handles multiple chunks with partial lines', () => {
    const parser = new JsonlStreamParser();

    parser.feed('{"type":"thread.sta');
    parser.feed('rted"}\n{"type":"tur');
    const events = parser.feed('n.started"}\n');

    // The first event was completed in the second feed call
    const allEvents = parser.getAllEvents();
    expect(allEvents.length).toBe(2);
  });

  it('accumulates events across feeds', () => {
    const parser = new JsonlStreamParser();

    parser.feed('{"type":"thread.started"}\n');
    parser.feed('{"type":"turn.started"}\n');
    parser.feed('{"type":"turn.completed"}\n');

    const allEvents = parser.getAllEvents();
    expect(allEvents.length).toBe(3);
  });

  it('returns a copy from getAllEvents', () => {
    const parser = new JsonlStreamParser();
    parser.feed('{"type":"thread.started"}\n');

    const events1 = parser.getAllEvents();
    const events2 = parser.getAllEvents();
    expect(events1).toEqual(events2);
    expect(events1).not.toBe(events2); // different references
  });

  it('skips invalid lines', () => {
    const parser = new JsonlStreamParser();
    const events = parser.feed('not valid json\n{"type":"thread.started"}\n');
    expect(events.length).toBe(1);
    expect(events[0]!.type).toBe('thread.started');
  });

  it('skips empty lines', () => {
    const parser = new JsonlStreamParser();
    const events = parser.feed('\n\n{"type":"thread.started"}\n\n');
    expect(events.length).toBe(1);
  });

  it('reports stalled state after threshold', () => {
    const parser = new JsonlStreamParser();
    // Feed an event to set lastEventTime
    parser.feed('{"type":"thread.started"}\n');
    // Use -1 threshold so any elapsed time > -1 is considered stalled
    expect(parser.isStalled(-1)).toBe(true);
  });

  it('reports not stalled when events are recent', () => {
    const parser = new JsonlStreamParser();
    parser.feed('{"type":"thread.started"}\n');
    expect(parser.isStalled(60_000)).toBe(false);
  });

  it('getLastEventTime returns a timestamp', () => {
    const parser = new JsonlStreamParser();
    const before = Date.now();
    parser.feed('{"type":"thread.started"}\n');
    const after = Date.now();
    expect(parser.getLastEventTime()).toBeGreaterThanOrEqual(before);
    expect(parser.getLastEventTime()).toBeLessThanOrEqual(after);
  });
});

// ─── extractDiff Tests ──────────────────────────────────────────────

describe('extractDiff', () => {
  it('extracts diff lines from mixed output', () => {
    const stdout = [
      'Some info message',
      'diff --git a/src/index.ts b/src/index.ts',
      '--- a/src/index.ts',
      '+++ b/src/index.ts',
      '@@ -1,3 +1,4 @@',
      ' line 1',
      '+new line',
      ' line 2',
    ].join('\n');

    const diff = extractDiff(stdout);
    expect(diff).toContain('diff --git');
    expect(diff).toContain('+new line');
    expect(diff).not.toContain('Some info message');
  });

  it('returns empty string when no diff markers found', () => {
    const diff = extractDiff('Just some output without any diff');
    expect(diff).toBe('');
  });

  it('handles output starting with --- line', () => {
    const stdout = '--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new';
    const diff = extractDiff(stdout);
    expect(diff).toContain('--- a/file.ts');
    expect(diff).toContain('+new');
  });
});

// ─── extractModifiedFiles Tests ─────────────────────────────────────

describe('extractModifiedFiles', () => {
  it('extracts file paths from +++ lines', () => {
    const diff = [
      'diff --git a/src/index.ts b/src/index.ts',
      '--- a/src/index.ts',
      '+++ b/src/index.ts',
      'diff --git a/src/utils.ts b/src/utils.ts',
      '--- a/src/utils.ts',
      '+++ b/src/utils.ts',
    ].join('\n');

    const files = extractModifiedFiles(diff);
    expect(files).toContain('src/index.ts');
    expect(files).toContain('src/utils.ts');
    expect(files.length).toBe(2);
  });

  it('deduplicates file paths', () => {
    const diff = [
      '+++ b/src/index.ts',
      '+++ b/src/index.ts',
    ].join('\n');

    const files = extractModifiedFiles(diff);
    expect(files.length).toBe(1);
  });

  it('returns empty array for no matches', () => {
    const files = extractModifiedFiles('no diff content here');
    expect(files).toEqual([]);
  });

  it('does not match lines that are not +++ b/ prefixed', () => {
    const diff = '+++ something else\n+++ b/real-file.ts';
    const files = extractModifiedFiles(diff);
    expect(files).toEqual(['real-file.ts']);
  });
});
