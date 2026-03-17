import { describe, it, expect } from 'vitest';
import { parseCodexEvent } from './codex-stream.js';
import type { JsonlEvent } from '../types.js';

describe('parseCodexEvent', () => {
  describe('thread.started', () => {
    it('emits progress event', () => {
      const ev = parseCodexEvent({ type: 'thread.started' });
      expect(ev).toEqual({ type: 'progress', message: 'Codex started', elapsed: 0 });
    });
  });

  describe('turn.started', () => {
    it('emits progress event', () => {
      const ev = parseCodexEvent({ type: 'turn.started' });
      expect(ev).toEqual({ type: 'progress', message: 'Codex turn started', elapsed: 0 });
    });
  });

  describe('turn.completed', () => {
    it('emits progress event', () => {
      const ev = parseCodexEvent({ type: 'turn.completed' });
      expect(ev).toEqual({ type: 'progress', message: 'Codex turn completed', elapsed: 0 });
    });
  });

  describe('item.started', () => {
    it('emits stream chunk for message item with content', () => {
      const ev = parseCodexEvent({
        type: 'item.started',
        item: { type: 'message', content: 'Starting to work on this…' },
      });
      expect(ev).toEqual({ type: 'stream', chunk: 'Starting to work on this…' });
    });

    it('returns null for message item without content', () => {
      const ev = parseCodexEvent({
        type: 'item.started',
        item: { type: 'message' },
      });
      expect(ev).toBeNull();
    });

    it('returns null for non-message item type', () => {
      const ev = parseCodexEvent({
        type: 'item.started',
        item: { type: 'tool_call', content: 'tool input' },
      });
      expect(ev).toBeNull();
    });

    it('returns null when item is missing', () => {
      const ev = parseCodexEvent({ type: 'item.started' });
      expect(ev).toBeNull();
    });
  });

  describe('item.completed', () => {
    it('emits stream chunk for message item with content', () => {
      const ev = parseCodexEvent({
        type: 'item.completed',
        item: { type: 'message', content: 'Done writing tests.' },
      });
      expect(ev).toEqual({ type: 'stream', chunk: 'Done writing tests.' });
    });

    it('emits tool_use event for tool_call item with content', () => {
      const ev = parseCodexEvent({
        type: 'item.completed',
        item: { type: 'tool_call', content: 'read_file(src/index.ts)' },
      });
      expect(ev).toEqual({
        type: 'tool_use',
        tool: 'codex_tool',
        input: { content: 'read_file(src/index.ts)' },
      });
    });

    it('returns null when item is missing', () => {
      const ev = parseCodexEvent({ type: 'item.completed' });
      expect(ev).toBeNull();
    });

    it('returns null for item.completed message without content', () => {
      const ev = parseCodexEvent({
        type: 'item.completed',
        item: { type: 'message' },
      });
      expect(ev).toBeNull();
    });
  });

  describe('unknown event types', () => {
    it('returns null for unknown type', () => {
      const ev = parseCodexEvent({ type: 'unknown.event' as JsonlEvent['type'] });
      expect(ev).toBeNull();
    });
  });
});
