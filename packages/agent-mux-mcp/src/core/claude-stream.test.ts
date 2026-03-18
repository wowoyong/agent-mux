import { describe, it, expect } from 'vitest';
import { parseClaudeStreamEvent } from './claude-stream.js';

describe('parseClaudeStreamEvent', () => {
  describe('assistant — text content', () => {
    it('emits stream chunk for text content', () => {
      const ev = parseClaudeStreamEvent({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      });
      expect(ev).toEqual([{ type: 'stream', chunk: 'Hello world' }]);
    });

    it('emits multiple events for mixed content', () => {
      const ev = parseClaudeStreamEvent({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'Let me think…' },
            { type: 'text', text: 'Here is my answer' },
          ],
        },
      });
      expect(ev).toEqual([
        { type: 'thinking', content: 'Let me think…' },
        { type: 'stream', chunk: 'Here is my answer' },
      ]);
    });

    it('returns null when content is empty', () => {
      const ev = parseClaudeStreamEvent({
        type: 'assistant',
        message: { role: 'assistant', content: [] },
      });
      expect(ev).toBeNull();
    });

    it('returns null when message is missing', () => {
      const ev = parseClaudeStreamEvent({ type: 'assistant' });
      expect(ev).toBeNull();
    });
  });

  describe('result', () => {
    it('emits done event with summary', () => {
      const ev = parseClaudeStreamEvent({
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: 'Task completed successfully',
      });
      expect(ev).toEqual({ type: 'done', summary: 'Task completed successfully' });
    });

    it('emits error event when is_error is true', () => {
      const ev = parseClaudeStreamEvent({
        type: 'result',
        subtype: 'error',
        is_error: true,
        result: 'Something went wrong',
      });
      expect(ev).toEqual({ type: 'error', message: 'Something went wrong', recoverable: false });
    });
  });

  describe('tool_use', () => {
    it('emits tool_use event with name and input', () => {
      const ev = parseClaudeStreamEvent({
        type: 'tool_use',
        name: 'read_file',
        input: { path: 'src/index.ts' },
      });
      expect(ev).toEqual({
        type: 'tool_use',
        tool: 'read_file',
        input: { path: 'src/index.ts' },
      });
    });

    it('uses "unknown" for missing tool name', () => {
      const ev = parseClaudeStreamEvent({ type: 'tool_use' });
      expect(ev).toEqual({ type: 'tool_use', tool: 'unknown', input: {} });
    });
  });

  describe('tool_result', () => {
    it('emits tool_result event with string content', () => {
      const ev = parseClaudeStreamEvent({
        type: 'tool_result',
        content: 'file content here',
      });
      expect(ev).toEqual({ type: 'tool_result', output: 'file content here' });
    });

    it('emits tool_result event with array content', () => {
      const ev = parseClaudeStreamEvent({
        type: 'tool_result',
        content: [
          { type: 'text', text: 'line 1\n' },
          { type: 'text', text: 'line 2\n' },
        ],
      });
      expect(ev).toEqual({ type: 'tool_result', output: 'line 1\nline 2\n' });
    });

    it('emits empty output for missing content', () => {
      const ev = parseClaudeStreamEvent({ type: 'tool_result' });
      expect(ev).toEqual({ type: 'tool_result', output: '' });
    });
  });

  describe('skipped event types', () => {
    it('returns null for system events', () => {
      const ev = parseClaudeStreamEvent({ type: 'system', subtype: 'init' });
      expect(ev).toBeNull();
    });

    it('returns null for rate_limit_event', () => {
      const ev = parseClaudeStreamEvent({ type: 'rate_limit_event' });
      expect(ev).toBeNull();
    });

    it('returns null for unknown type', () => {
      const ev = parseClaudeStreamEvent({ type: 'ping' });
      expect(ev).toBeNull();
    });
  });
});
