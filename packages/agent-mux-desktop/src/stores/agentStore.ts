import { create } from 'zustand';

export interface AgentSession {
  id: string;
  terminalId: string;
  agent: 'claude' | 'codex';
  task: string;
  status: 'routing' | 'running' | 'waiting' | 'done' | 'error';
  routingConfidence?: number;
  routingReason?: string;
  startedAt: number;
  completedAt?: number;
}

export interface BudgetInfo {
  claude: { used: number; limit: number };
  codex: { used: number; limit: number };
  resetAt: number;
}

export interface AgentState {
  sessions: AgentSession[];
  budget: BudgetInfo;
  createSession: (terminalId: string, task: string, agent?: 'claude' | 'codex' | 'auto') => string;
  updateSession: (id: string, updates: Partial<AgentSession>) => void;
  removeSession: (id: string) => void;
  updateBudget: (budget: Partial<BudgetInfo>) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  sessions: [],
  budget: {
    claude: { used: 0, limit: 1000 },
    codex: { used: 0, limit: 500 },
    resetAt: Date.now() + 24 * 60 * 60 * 1000,
  },

  createSession: (terminalId, task, agent) => {
    const id = crypto.randomUUID();
    const session: AgentSession = {
      id,
      terminalId,
      agent: agent === 'auto' || !agent ? 'claude' : agent,
      task,
      status: agent === 'auto' || !agent ? 'routing' : 'running',
      startedAt: Date.now(),
    };
    set((s) => ({ sessions: [...s.sessions, session] }));
    return id;
  },

  updateSession: (id, updates) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, ...updates } : sess
      ),
    }));
  },

  removeSession: (id) => {
    set((s) => ({ sessions: s.sessions.filter((sess) => sess.id !== id) }));
  },

  updateBudget: (budget) => {
    set((s) => ({ budget: { ...s.budget, ...budget } }));
  },
}));
