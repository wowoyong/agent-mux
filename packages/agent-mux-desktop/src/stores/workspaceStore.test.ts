import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from './workspaceStore';

const store = useWorkspaceStore;

function getState() {
  return store.getState();
}

function resetStore() {
  // Grab a fresh default workspace via createWorkspace logic
  store.setState({
    workspaces: [],
    activeWorkspaceId: null,
    sidebarCollapsed: false,
  });
  // Create one default workspace to mimic initial state
  getState().createWorkspace('Workspace 1');
}

describe('workspaceStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('initial state', () => {
    it('has 1 default workspace', () => {
      expect(getState().workspaces).toHaveLength(1);
    });

    it('activeWorkspaceId is set', () => {
      expect(getState().activeWorkspaceId).toBe(getState().workspaces[0].id);
    });

    it('sidebarCollapsed is false', () => {
      expect(getState().sidebarCollapsed).toBe(false);
    });
  });

  describe('createWorkspace', () => {
    it('creates new workspace with correct defaults and sets it as active', () => {
      const id = getState().createWorkspace();
      const ws = getState().workspaces.find((w) => w.id === id);
      expect(ws).toBeDefined();
      expect(ws!.terminals).toHaveLength(1);
      expect(ws!.terminals[0].type).toBe('shell');
      expect(ws!.activeTerminalId).toBe(ws!.terminals[0].id);
      expect(getState().activeWorkspaceId).toBe(id);
      expect(getState().workspaces).toHaveLength(2);
    });

    it('uses provided name', () => {
      const id = getState().createWorkspace('My Custom WS');
      const ws = getState().workspaces.find((w) => w.id === id);
      expect(ws!.name).toBe('My Custom WS');
    });
  });

  describe('removeWorkspace', () => {
    it('removes workspace and updates activeWorkspaceId to remaining', () => {
      const id2 = getState().createWorkspace('WS 2');
      const id1 = getState().workspaces[0].id;
      // active is id2 now
      getState().removeWorkspace(id2);
      expect(getState().workspaces).toHaveLength(1);
      expect(getState().activeWorkspaceId).toBe(id1);
    });

    it('activeWorkspaceId becomes null when last workspace removed', () => {
      const id = getState().workspaces[0].id;
      getState().removeWorkspace(id);
      expect(getState().workspaces).toHaveLength(0);
      expect(getState().activeWorkspaceId).toBeNull();
    });
  });

  describe('setActiveWorkspace', () => {
    it('switches active workspace', () => {
      const id2 = getState().createWorkspace('WS 2');
      const id1 = getState().workspaces[0].id;
      getState().setActiveWorkspace(id1);
      expect(getState().activeWorkspaceId).toBe(id1);
      getState().setActiveWorkspace(id2);
      expect(getState().activeWorkspaceId).toBe(id2);
    });
  });

  describe('toggleSidebar', () => {
    it('toggles sidebarCollapsed', () => {
      expect(getState().sidebarCollapsed).toBe(false);
      getState().toggleSidebar();
      expect(getState().sidebarCollapsed).toBe(true);
      getState().toggleSidebar();
      expect(getState().sidebarCollapsed).toBe(false);
    });
  });

  describe('addTerminal', () => {
    it('adds terminal to workspace with correct defaults', () => {
      const wsId = getState().workspaces[0].id;
      const termId = getState().addTerminal(wsId, {
        type: 'agent',
        title: 'Agent Terminal',
        cwd: '/home',
        agentType: 'claude',
      });
      const ws = getState().workspaces.find((w) => w.id === wsId)!;
      const term = ws.terminals.find((t) => t.id === termId)!;
      expect(term).toBeDefined();
      expect(term.unreadCount).toBe(0);
      expect(term.needsAttention).toBe(false);
      expect(term.status).toBe('idle');
      expect(term.type).toBe('agent');
      expect(term.title).toBe('Agent Terminal');
    });
  });

  describe('updateTerminal', () => {
    it('updates terminal fields', () => {
      const wsId = getState().workspaces[0].id;
      const termId = getState().workspaces[0].terminals[0].id;
      getState().updateTerminal(wsId, termId, { status: 'running', unreadCount: 5 });
      const term = getState().workspaces.find((w) => w.id === wsId)!.terminals.find((t) => t.id === termId)!;
      expect(term.status).toBe('running');
      expect(term.unreadCount).toBe(5);
    });
  });

  describe('markRead', () => {
    it('sets unreadCount=0 and needsAttention=false', () => {
      const wsId = getState().workspaces[0].id;
      const termId = getState().workspaces[0].terminals[0].id;
      getState().updateTerminal(wsId, termId, { unreadCount: 10, needsAttention: true });
      getState().markRead(wsId, termId);
      const term = getState().workspaces.find((w) => w.id === wsId)!.terminals.find((t) => t.id === termId)!;
      expect(term.unreadCount).toBe(0);
      expect(term.needsAttention).toBe(false);
    });
  });

  describe('splitPane', () => {
    it('splits leaf pane into two children with direction and ratio=0.5', () => {
      const wsId = getState().workspaces[0].id;
      const paneId = getState().workspaces[0].panes.id;
      getState().splitPane(wsId, paneId, 'horizontal');
      const ws = getState().workspaces.find((w) => w.id === wsId)!;
      expect(ws.panes.children).toBeDefined();
      expect(ws.panes.children).toHaveLength(2);
      expect(ws.panes.direction).toBe('horizontal');
      expect(ws.panes.ratio).toBe(0.5);
    });

    it('preserves original terminal and creates new shell terminal', () => {
      const wsId = getState().workspaces[0].id;
      const originalTermId = getState().workspaces[0].terminals[0].id;
      const paneId = getState().workspaces[0].panes.id;
      getState().splitPane(wsId, paneId, 'vertical');
      const ws = getState().workspaces.find((w) => w.id === wsId)!;
      // Original terminal should still exist
      expect(ws.terminals.find((t) => t.id === originalTermId)).toBeDefined();
      // Should now have 2 terminals
      expect(ws.terminals).toHaveLength(2);
      // The new terminal should be a shell
      const newTerm = ws.terminals.find((t) => t.id !== originalTermId)!;
      expect(newTerm.type).toBe('shell');
      // First child should reference original terminal
      expect(ws.panes.children![0].terminalId).toBe(originalTermId);
      // Second child should reference new terminal
      expect(ws.panes.children![1].terminalId).toBe(newTerm.id);
    });
  });

  describe('closePane', () => {
    it('removes pane and its terminals', () => {
      const wsId = getState().workspaces[0].id;
      const paneId = getState().workspaces[0].panes.id;
      getState().splitPane(wsId, paneId, 'horizontal');
      const ws = getState().workspaces.find((w) => w.id === wsId)!;
      const secondChildPaneId = ws.panes.children![1].id;
      const secondTermId = ws.panes.children![1].terminalId;

      getState().closePane(wsId, secondChildPaneId);
      const wsAfter = getState().workspaces.find((w) => w.id === wsId)!;
      expect(wsAfter.terminals.find((t) => t.id === secondTermId)).toBeUndefined();
      // Should be back to one terminal
      expect(wsAfter.terminals).toHaveLength(1);
    });

    it('updates activeTerminalId if removed terminal was active', () => {
      const wsId = getState().workspaces[0].id;
      const paneId = getState().workspaces[0].panes.id;
      getState().splitPane(wsId, paneId, 'horizontal');
      const ws = getState().workspaces.find((w) => w.id === wsId)!;
      const secondChildPaneId = ws.panes.children![1].id;
      const secondTermId = ws.panes.children![1].terminalId;

      // Set active to the second terminal
      getState().setActiveTerminal(wsId, secondTermId);
      expect(getState().workspaces.find((w) => w.id === wsId)!.activeTerminalId).toBe(secondTermId);

      // Close the pane containing the active terminal
      getState().closePane(wsId, secondChildPaneId);
      const wsAfter = getState().workspaces.find((w) => w.id === wsId)!;
      // Active should switch to remaining terminal
      expect(wsAfter.activeTerminalId).toBe(wsAfter.terminals[0].id);
    });
  });

  describe('setActiveTerminal', () => {
    it('updates workspace activeTerminalId', () => {
      const wsId = getState().workspaces[0].id;
      const termId = getState().addTerminal(wsId, { type: 'shell', title: 'T2', cwd: '~' });
      getState().setActiveTerminal(wsId, termId);
      expect(getState().workspaces.find((w) => w.id === wsId)!.activeTerminalId).toBe(termId);
    });
  });

  describe('resizePane', () => {
    it('updates pane ratio', () => {
      const wsId = getState().workspaces[0].id;
      const paneId = getState().workspaces[0].panes.id;
      getState().splitPane(wsId, paneId, 'horizontal');
      const splitPaneId = getState().workspaces.find((w) => w.id === wsId)!.panes.id;
      getState().resizePane(wsId, splitPaneId, 0.7);
      expect(getState().workspaces.find((w) => w.id === wsId)!.panes.ratio).toBe(0.7);
    });
  });

  describe('jumpToNextUnread', () => {
    it('jumps to first workspace with unread terminal', () => {
      // Create a second workspace
      const ws2Id = getState().createWorkspace('WS 2');
      const ws1Id = getState().workspaces[0].id;

      // Set active to ws1
      getState().setActiveWorkspace(ws1Id);

      // Add unread count to ws1's terminal
      const ws1TermId = getState().workspaces[0].terminals[0].id;
      getState().updateTerminal(ws1Id, ws1TermId, { unreadCount: 3 });

      // Jump should go to ws1 (first with unread)
      getState().jumpToNextUnread();
      expect(getState().activeWorkspaceId).toBe(ws1Id);
      // After jump, unread should be marked read
      const term = getState().workspaces.find((w) => w.id === ws1Id)!.terminals.find((t) => t.id === ws1TermId)!;
      expect(term.unreadCount).toBe(0);
    });
  });
});
