import { useWorkspaceStore } from '../../stores/workspaceStore';
import { PaneLayout } from './PaneLayout';

export function WorkspaceView() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);

  if (!workspace) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <p className="text-[#737373] text-sm">No active workspace</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 bg-[#0a0a0a]">
      <PaneLayout pane={workspace.panes} workspace={workspace} />
    </div>
  );
}
