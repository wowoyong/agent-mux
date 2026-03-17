import { describe, it, expect } from 'vitest';
import { parseClaudeStreamEvent } from './claude-stream.js';

describe('parseClaudeStreamEvent', () => {
  describe('content_block_delta — text_delta', () => {
    it('emits stream chunk for text_delta', () => {
      const ev = parseClaudeStreamEvent({
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'Hello world' },
      });
      expect(ev).toEqual({ type: 'stream', chunk: 'Hello world' });
    });

    it('returns null for empty text_delta', () => {
      // text is empty string — still a valid stream event
      const ev = parseClaudeStreamEvent({
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: '' },
      });
      expect(ev).toEqual({ type: 'stream', chunk: '' });
    });
  });

  describe('content_block_delta — thinking_delta', () => {
    it('emits thinking event for thinking_delta', () => {
      const ev = parseClaudeStreamEvent({
        type: 'content_block_delta',
        delta: { type: 'thinking_delta', thinking: 'Let me think…' },
      });
      expect(ev).toEqual({ type: 'thinking', content: 'Let me think…' });
    });

    it('returns null when delta is missing', () => {
      const ev = parseClaudeStreamEvent({ type: 'content_block_delta' });
      expect(ev).toBeNull();
    });

    it('returns null for unknown delta type', () => {
      const ev = parseClaudeStreamEvent({
        type: 'content_block_delta',
        delta: { type: 'unknown_delta' },
      });
      expect(ev).toBeNull();
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

    it('uses empty object for missing input', () => {
      const ev = parseClaudeStreamEvent({ type: 'tool_use', name: 'bash' });
      expect(ev).toEqual({ type: 'tool_use', tool: 'bash', input: {} });
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

    it('skips non-text content items in array', () => {
      const ev = parseClaudeStreamEvent({
        type: 'tool_result',
        content: [
          { type: 'image', text: 'should be ignored' },
          { type: 'text', text: 'visible' },
        ],
      });
      expect(ev).toEqual({ type: 'tool_result', output: 'visible' });
    });

    it('emits empty output for missing content', () => {
      const ev = parseClaudeStreamEvent({ type: 'tool_result' });
      expect(ev).toEqual({ type: 'tool_result', output: '' });
    });
  });

  describe('message_stop', () => {
    it('emits done event', () => {
      const ev = parseClaudeStreamEvent({ type: 'message_stop' });
      expect(ev).toEqual({ type: 'done', summary: '' });
    });
  });

  describe('message_delta', () => {
    it('returns null for message_delta (not a completion marker)', () => {
      const ev = parseClaudeStreamEvent({ type: 'message_delta' });
      expect(ev).toBeNull();
    });
  });

  describe('error', () => {
    it('emits error event with message', () => {
      const ev = parseClaudeStreamEvent({
        type: 'error',
        error: { message: 'Rate limit exceeded', type: 'rate_limit_error' },
      });
      expect(ev).toEqual({ type: 'error', message: 'Rate limit exceeded', recoverable: false });
    });

    it('uses error.type when message is missing', () => {
      const ev = parseClaudeStreamEvent({
        type: 'error',
        error: { type: 'invalid_request_error' },
      });
      expect(ev).toEqual({ type: 'error', message: 'invalid_request_error', recoverable: false });
    });

    it('uses fallback message when error is empty', () => {
      const ev = parseClaudeStreamEvent({ type: 'error', error: {} });
      expect(ev).toEqual({ type: 'error', message: 'Unknown Claude error', recoverable: false });
    });

    it('handles missing error field', () => {
      const ev = parseClaudeStreamEvent({ type: 'error' });
      expect(ev).toEqual({ type: 'error', message: 'Unknown Claude error', recoverable: false });
    });
  });

  describe('unknown event types', () => {
    it('returns null for message_start', () => {
      const ev = parseClaudeStreamEvent({ type: 'message_start' });
      expect(ev).toBeNull();
    });

    it('returns null for content_block_start', () => {
      const ev = parseClaudeStreamEvent({ type: 'content_block_start' });
      expect(ev).toBeNull();
    });

    it('returns null for content_block_stop', () => {
      const ev = parseClaudeStreamEvent({ type: 'content_block_stop' });
      expect(ev).toBeNull();
    });

    it('returns null for completely unknown type', () => {
      const ev = parseClaudeStreamEvent({ type: 'ping' });
      expect(ev).toBeNull();
    });
  });
});
