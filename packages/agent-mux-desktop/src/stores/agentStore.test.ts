import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentStore } from './agentStore';

const store = useAgentStore;

function getState() {
  return store.getState();
}

describe('agentStore', () => {
  beforeEach(() => {
    store.setState({
      sessions: [],
      budget: {
        claude: { used: 0, limit: 1000 },
        codex: { used: 0, limit: 500 },
        resetAt: Date.now() + 24 * 60 * 60 * 1000,
      },
    });
  });

  describe('initial state', () => {
    it('has empty sessions', () => {
      expect(getState().sessions).toEqual([]);
    });

    it('budget has defaults', () => {
      expect(getState().budget.claude.used).toBe(0);
      expect(getState().budget.claude.limit).toBe(1000);
      expect(getState().budget.codex.used).toBe(0);
      expect(getState().budget.codex.limit).toBe(500);
      expect(getState().budget.resetAt).toBeGreaterThan(Date.now());
    });
  });

  describe('createSession', () => {
    it('creates session with correct fields when agent specified', () => {
      const id = getState().createSession('term-1', 'Fix the bug', 'codex');
      const session = getState().sessions.find((s) => s.id === id)!;
      expect(session).toBeDefined();
      expect(session.terminalId).toBe('term-1');
      expect(session.task).toBe('Fix the bug');
      expect(session.agent).toBe('codex');
      expect(session.status).toBe('running');
      expect(session.startedAt).toBeLessThanOrEqual(Date.now());
    });

    it('defaults to claude with routing status when agent is auto', () => {
      const id = getState().createSession('term-2', 'Write tests', 'auto');
      const session = getState().sessions.find((s) => s.id === id)!;
      expect(session.agent).toBe('claude');
      expect(session.status).toBe('routing');
    });

    it('defaults to claude with routing status when agent is not provided', () => {
      const id = getState().createSession('term-3', 'Refactor code');
      const session = getState().sessions.find((s) => s.id === id)!;
      expect(session.agent).toBe('claude');
      expect(session.status).toBe('routing');
    });
  });

  describe('updateSession', () => {
    it('updates session fields', () => {
      const id = getState().createSession('term-1', 'Task', 'claude');
      getState().updateSession(id, { status: 'done', completedAt: Date.now() });
      const session = getState().sessions.find((s) => s.id === id)!;
      expect(session.status).toBe('done');
      expect(session.completedAt).toBeDefined();
    });
  });

  describe('removeSession', () => {
    it('removes session', () => {
      const id = getState().createSession('term-1', 'Task', 'claude');
      expect(getState().sessions).toHaveLength(1);
      getState().removeSession(id);
      expect(getState().sessions).toHaveLength(0);
    });
  });

  describe('updateBudget', () => {
    it('updates budget info', () => {
      getState().updateBudget({ claude: { used: 250, limit: 1000 } });
      expect(getState().budget.claude.used).toBe(250);
      expect(getState().budget.claude.limit).toBe(1000);
      // codex should remain unchanged
      expect(getState().budget.codex.used).toBe(0);
    });
  });
});
