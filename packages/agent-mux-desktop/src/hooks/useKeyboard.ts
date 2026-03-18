import { useEffect } from 'react';
import { setupKeybindings } from '../lib/keybindings';
import { useWorkspaceStore } from '../stores/workspaceStore';

export function useKeyboard() {
  useEffect(() => {
    const cleanup = setupKeybindings([
      {
        key: 'n',
        meta: true,
        handler: () => useWorkspaceStore.getState().createWorkspace(),
      },
      {
        key: 'w',
        meta: true,
        handler: () => {
          const { activeWorkspaceId, removeWorkspace } = useWorkspaceStore.getState();
          if (activeWorkspaceId) removeWorkspace(activeWorkspaceId);
        },
      },
      // Cmd+1-9: switch workspace
      ...Array.from({ length: 9 }, (_, i) => ({
        key: String(i + 1),
        meta: true,
        handler: () => {
          const { workspaces, setActiveWorkspace } = useWorkspaceStore.getState();
          if (workspaces[i]) setActiveWorkspace(workspaces[i].id);
        },
      })),
      {
        key: 'd',
        meta: true,
        handler: () => {
          const { workspaces, activeWorkspaceId, splitPane } = useWorkspaceStore.getState();
          const ws = workspaces.find((w) => w.id === activeWorkspaceId);
          if (ws) splitPane(ws.id, ws.panes.id, 'vertical');
        },
      },
      {
        key: 'd',
        meta: true,
        shift: true,
        handler: () => {
          const { workspaces, activeWorkspaceId, splitPane } = useWorkspaceStore.getState();
          const ws = workspaces.find((w) => w.id === activeWorkspaceId);
          if (ws) splitPane(ws.id, ws.panes.id, 'horizontal');
        },
      },
      {
        key: 'u',
        meta: true,
        shift: true,
        handler: () => useWorkspaceStore.getState().jumpToNextUnread(),
      },
      {
        key: 'l',
        meta: true,
        handler: () => {
          const input = document.querySelector<HTMLInputElement>('[data-input-bar]');
          input?.focus();
        },
      },
      {
        key: '[',
        meta: true,
        shift: true,
        handler: () => {
          const { workspaces, activeWorkspaceId, setActiveWorkspace } = useWorkspaceStore.getState();
          const idx = workspaces.findIndex((w) => w.id === activeWorkspaceId);
          if (idx > 0) setActiveWorkspace(workspaces[idx - 1].id);
        },
      },
      {
        key: ']',
        meta: true,
        shift: true,
        handler: () => {
          const { workspaces, activeWorkspaceId, setActiveWorkspace } = useWorkspaceStore.getState();
          const idx = workspaces.findIndex((w) => w.id === activeWorkspaceId);
          if (idx < workspaces.length - 1) setActiveWorkspace(workspaces[idx + 1].id);
        },
      },
    ]);

    return cleanup;
  }, []);
}
