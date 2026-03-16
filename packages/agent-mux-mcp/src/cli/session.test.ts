import { describe, it, expect, afterEach } from 'vitest';
import { saveSession, loadSession, clearSession } from './session.js';
import type { SessionState } from './session.js';

describe('session', () => {
  afterEach(async () => {
    await clearSession();
  });

  it('saves and loads session state', async () => {
    const state: SessionState = {
      startedAt: Date.now(),
      lastActive: Date.now(),
      taskCount: 5,
      cwd: '/tmp/test',
    };
    await saveSession(state);
    const loaded = await loadSession();
    expect(loaded).toEqual(state);
  });

  it('returns null when no session exists', async () => {
    await clearSession();
    const loaded = await loadSession();
    expect(loaded).toBeNull();
  });

  it('clearSession removes session file', async () => {
    await saveSession({ startedAt: 1, lastActive: 1, taskCount: 0, cwd: '/' });
    await clearSession();
    expect(await loadSession()).toBeNull();
  });

  it('overwrites existing session on save', async () => {
    await saveSession({ startedAt: 1, lastActive: 1, taskCount: 0, cwd: '/a' });
    await saveSession({ startedAt: 2, lastActive: 2, taskCount: 3, cwd: '/b' });
    const loaded = await loadSession();
    expect(loaded?.startedAt).toBe(2);
    expect(loaded?.taskCount).toBe(3);
    expect(loaded?.cwd).toBe('/b');
  });
});
