import { describe, it, expect, vi, afterEach } from 'vitest';
import { setupKeybindings } from './keybindings';

function fireKey(key: string, options: Partial<KeyboardEventInit> = {}, target?: EventTarget) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    ...options,
  });
  if (target) {
    Object.defineProperty(event, 'target', { value: target });
  }
  window.dispatchEvent(event);
}

describe('keybindings', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it('calls handler on matching keydown', () => {
    const handler = vi.fn();
    cleanup = setupKeybindings([{ key: 'a', handler }]);
    fireKey('a');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('only fires when meta/cmd pressed', () => {
    const handler = vi.fn();
    cleanup = setupKeybindings([{ key: 'k', meta: true, handler }]);
    // Without meta - should not fire
    fireKey('k');
    expect(handler).not.toHaveBeenCalled();
    // With meta - should fire
    fireKey('k', { metaKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('only fires when shift pressed', () => {
    const handler = vi.fn();
    cleanup = setupKeybindings([{ key: 'p', shift: true, handler }]);
    // Without shift
    fireKey('p');
    expect(handler).not.toHaveBeenCalled();
    // With shift
    fireKey('p', { shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire for non-matching keys', () => {
    const handler = vi.fn();
    cleanup = setupKeybindings([{ key: 'a', handler }]);
    fireKey('b');
    fireKey('c');
    expect(handler).not.toHaveBeenCalled();
  });

  it('removes listener when cleanup function called', () => {
    const handler = vi.fn();
    cleanup = setupKeybindings([{ key: 'a', handler }]);
    fireKey('a');
    expect(handler).toHaveBeenCalledTimes(1);
    cleanup();
    cleanup = undefined;
    fireKey('a');
    expect(handler).toHaveBeenCalledTimes(1); // no additional call
  });

  it('does not fire when target is INPUT element', () => {
    const handler = vi.fn();
    cleanup = setupKeybindings([{ key: 'a', handler }]);
    const input = document.createElement('input');
    fireKey('a', {}, input);
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire when target is TEXTAREA element', () => {
    const handler = vi.fn();
    cleanup = setupKeybindings([{ key: 'a', handler }]);
    const textarea = document.createElement('textarea');
    fireKey('a', {}, textarea);
    expect(handler).not.toHaveBeenCalled();
  });
});
