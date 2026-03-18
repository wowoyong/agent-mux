import { create } from 'zustand';

export interface Terminal {
  id: string;
  type: 'shell' | 'agent';
  agentType?: 'claude' | 'codex' | 'auto';
  title: string;
  cwd: string;
  gitBranch?: string;
  unreadCount: number;
  needsAttention: boolean;
  status: 'idle' | 'running' | 'waiting' | 'error' | 'done';
  initialCommand?: string; // auto-run on PTY spawn
}

export interface Pane {
  id: string;
  terminalId: string;
  direction?: 'horizontal' | 'vertical';
  children?: [Pane, Pane];
  ratio?: number;
}

export interface Workspace {
  id: string;
  name: string;
  icon?: string;
  panes: Pane;
  activeTerminalId: string;
  terminals: Terminal[];
  createdAt: number;
}

export interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  sidebarCollapsed: boolean;

  createWorkspace: (name?: string) => string;
  removeWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string) => void;
  toggleSidebar: () => void;

  addTerminal: (workspaceId: string, terminal: Omit<Terminal, 'id' | 'unreadCount' | 'needsAttention' | 'status'>) => string;
  updateTerminal: (workspaceId: string, terminalId: string, updates: Partial<Terminal>) => void;
  markRead: (workspaceId: string, terminalId: string) => void;

  splitPane: (workspaceId: string, paneId: string, direction: 'horizontal' | 'vertical') => void;
  closePane: (workspaceId: string, paneId: string) => void;
  setActiveTerminal: (workspaceId: string, terminalId: string) => void;
  resizePane: (workspaceId: string, paneId: string, ratio: number) => void;

  jumpToNextUnread: () => void;
}

function createMuxTerminal(name: string): Terminal {
  return {
    id: crypto.randomUUID(),
    type: 'agent',
    title: name,
    cwd: '~',
    unreadCount: 0,
    needsAttention: false,
    status: 'idle',
    initialCommand: 'mux',
  };
}

function createShellTerminal(name: string): Terminal {
  return {
    id: crypto.randomUUID(),
    type: 'shell',
    title: name,
    cwd: '~',
    unreadCount: 0,
    needsAttention: false,
    status: 'idle',
  };
}

function findPane(root: Pane, paneId: string): Pane | null {
  if (root.id === paneId) return root;
  if (root.children) {
    return findPane(root.children[0], paneId) || findPane(root.children[1], paneId);
  }
  return null;
}

function replacePaneInTree(root: Pane, paneId: string, replacement: Pane): Pane {
  if (root.id === paneId) return replacement;
  if (root.children) {
    return {
      ...root,
      children: [
        replacePaneInTree(root.children[0], paneId, replacement),
        replacePaneInTree(root.children[1], paneId, replacement),
      ],
    };
  }
  return root;
}

function removePaneFromTree(root: Pane, paneId: string): Pane | null {
  if (root.id === paneId) return null;
  if (root.children) {
    if (root.children[0].id === paneId) return root.children[1];
    if (root.children[1].id === paneId) return root.children[0];
    const left = removePaneFromTree(root.children[0], paneId);
    const right = removePaneFromTree(root.children[1], paneId);
    if (!left) return right;
    if (!right) return left;
    return { ...root, children: [left, right] };
  }
  return root;
}

function collectTerminalIds(pane: Pane): string[] {
  if (pane.children) {
    return [...collectTerminalIds(pane.children[0]), ...collectTerminalIds(pane.children[1])];
  }
  return [pane.terminalId];
}

const defaultTerminal = createMuxTerminal('Agent Mux');
const defaultWorkspace: Workspace = {
  id: crypto.randomUUID(),
  name: 'Workspace 1',
  panes: { id: crypto.randomUUID(), terminalId: defaultTerminal.id },
  activeTerminalId: defaultTerminal.id,
  terminals: [defaultTerminal],
  createdAt: Date.now(),
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [defaultWorkspace],
  activeWorkspaceId: defaultWorkspace.id,
  sidebarCollapsed: false,

  createWorkspace: (name?: string) => {
    const id = crypto.randomUUID();
    const terminal = createMuxTerminal('Agent Mux');
    const ws: Workspace = {
      id,
      name: name || `Workspace ${get().workspaces.length + 1}`,
      panes: { id: crypto.randomUUID(), terminalId: terminal.id },
      activeTerminalId: terminal.id,
      terminals: [terminal],
      createdAt: Date.now(),
    };
    set((s) => ({
      workspaces: [...s.workspaces, ws],
      activeWorkspaceId: id,
    }));
    return id;
  },

  removeWorkspace: (id: string) => {
    set((s) => {
      const filtered = s.workspaces.filter((w) => w.id !== id);
      const activeId = s.activeWorkspaceId === id
        ? (filtered[0]?.id ?? null)
        : s.activeWorkspaceId;
      return { workspaces: filtered, activeWorkspaceId: activeId };
    });
  },

  setActiveWorkspace: (id: string) => {
    set({ activeWorkspaceId: id });
  },

  toggleSidebar: () => {
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed }));
  },

  addTerminal: (workspaceId, terminalData) => {
    const id = crypto.randomUUID();
    const terminal: Terminal = {
      ...terminalData,
      id,
      unreadCount: 0,
      needsAttention: false,
      status: 'idle',
    };
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === workspaceId
          ? { ...w, terminals: [...w.terminals, terminal] }
          : w
      ),
    }));
    return id;
  },

  updateTerminal: (workspaceId, terminalId, updates) => {
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === workspaceId
          ? {
              ...w,
              terminals: w.terminals.map((t) =>
                t.id === terminalId ? { ...t, ...updates } : t
              ),
            }
          : w
      ),
    }));
  },

  markRead: (workspaceId, terminalId) => {
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === workspaceId
          ? {
              ...w,
              terminals: w.terminals.map((t) =>
                t.id === terminalId
                  ? { ...t, unreadCount: 0, needsAttention: false }
                  : t
              ),
            }
          : w
      ),
    }));
  },

  splitPane: (workspaceId, paneId, direction) => {
    set((s) => ({
      workspaces: s.workspaces.map((w) => {
        if (w.id !== workspaceId) return w;
        const targetPane = findPane(w.panes, paneId);
        if (!targetPane || targetPane.children) return w;

        const newTerminal = createShellTerminal('Shell');
        const newPane: Pane = {
          id: crypto.randomUUID(),
          terminalId: newTerminal.id,
        };
        const splitPane: Pane = {
          id: crypto.randomUUID(),
          terminalId: '',
          direction,
          children: [{ ...targetPane }, newPane],
          ratio: 0.5,
        };
        const newPanes = replacePaneInTree(w.panes, paneId, splitPane);
        return {
          ...w,
          panes: newPanes,
          terminals: [...w.terminals, newTerminal],
        };
      }),
    }));
  },

  closePane: (workspaceId, paneId) => {
    set((s) => ({
      workspaces: s.workspaces.map((w) => {
        if (w.id !== workspaceId) return w;
        const pane = findPane(w.panes, paneId);
        if (!pane) return w;

        const removedIds = collectTerminalIds(pane);
        const newPanes = removePaneFromTree(w.panes, paneId);
        if (!newPanes) return w;

        const remainingTerminals = w.terminals.filter(
          (t) => !removedIds.includes(t.id)
        );
        const activeStillExists = remainingTerminals.some(
          (t) => t.id === w.activeTerminalId
        );
        return {
          ...w,
          panes: newPanes,
          terminals: remainingTerminals,
          activeTerminalId: activeStillExists
            ? w.activeTerminalId
            : remainingTerminals[0]?.id ?? '',
        };
      }),
    }));
  },

  setActiveTerminal: (workspaceId, terminalId) => {
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === workspaceId ? { ...w, activeTerminalId: terminalId } : w
      ),
    }));
  },

  resizePane: (workspaceId, paneId, ratio) => {
    set((s) => ({
      workspaces: s.workspaces.map((w) => {
        if (w.id !== workspaceId) return w;
        const updateRatio = (p: Pane): Pane => {
          if (p.id === paneId) return { ...p, ratio };
          if (p.children) {
            return { ...p, children: [updateRatio(p.children[0]), updateRatio(p.children[1])] };
          }
          return p;
        };
        return { ...w, panes: updateRatio(w.panes) };
      }),
    }));
  },

  jumpToNextUnread: () => {
    const { workspaces } = get();
    for (const ws of workspaces) {
      const unread = ws.terminals.find((t) => t.unreadCount > 0);
      if (unread) {
        set({
          activeWorkspaceId: ws.id,
        });
        get().setActiveTerminal(ws.id, unread.id);
        get().markRead(ws.id, unread.id);
        return;
      }
    }
  },
}));
