import { GitBranch, Folder, Keyboard } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useAgentStore } from '../../stores/agentStore';

export function StatusBar() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const sessions = useAgentStore((s) => s.sessions);

  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const activeTerminal = workspace?.terminals.find(
    (t) => t.id === workspace.activeTerminalId
  );

  const activeSessions = sessions.filter((s) => s.status === 'running').length;

  return (
    <div className="flex items-center justify-between h-6 bg-[#111111] border-t border-[#262626] px-3 select-none">
      <div className="flex items-center gap-3 text-[11px] text-[#737373]">
        {/* Agent info */}
        {activeTerminal?.type === 'agent' && activeTerminal.agentType && (
          <span
            className="font-medium"
            style={{
              color: activeTerminal.agentType === 'claude' ? '#d97706' : '#8b5cf6',
            }}
          >
            {activeTerminal.agentType}
          </span>
        )}

        {/* Git branch */}
        {activeTerminal?.gitBranch && (
          <span className="flex items-center gap-1">
            <GitBranch size={10} />
            {activeTerminal.gitBranch}
          </span>
        )}

        {/* CWD */}
        {activeTerminal?.cwd && (
          <span className="flex items-center gap-1">
            <Folder size={10} />
            {activeTerminal.cwd.replace(/^\/Users\/[^/]+/, '~')}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-[#737373]">
        {/* Active sessions */}
        {activeSessions > 0 && (
          <span className="text-[#22c55e]">
            {activeSessions} running
          </span>
        )}

        {/* Keyboard hints */}
        <span className="flex items-center gap-1">
          <Keyboard size={10} />
          <kbd className="text-[10px]">Cmd+N</kbd> new
          <span className="mx-0.5">|</span>
          <kbd className="text-[10px]">Cmd+D</kbd> split
        </span>
      </div>
    </div>
  );
}
