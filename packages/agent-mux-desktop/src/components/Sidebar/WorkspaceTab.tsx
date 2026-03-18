import { Terminal as TerminalIcon, Bot } from 'lucide-react';
import { NotificationBadge } from '../Notifications/NotificationBadge';
import { NotificationRing } from '../Notifications/NotificationRing';
import type { Workspace } from '../../stores/workspaceStore';

interface WorkspaceTabProps {
  workspace: Workspace;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}

function statusColor(status: string): string {
  switch (status) {
    case 'running': return 'bg-[#22c55e]';
    case 'waiting': return 'bg-[#d97706]';
    case 'error': return 'bg-[#ef4444]';
    default: return 'bg-[#737373]';
  }
}

export function WorkspaceTab({ workspace, isActive, collapsed, onClick }: WorkspaceTabProps) {
  const activeTerminal = workspace.terminals.find(
    (t) => t.id === workspace.activeTerminalId
  );
  const totalUnread = workspace.terminals.reduce((sum, t) => sum + t.unreadCount, 0);
  const needsAttention = workspace.terminals.some((t) => t.needsAttention);
  const isAgent = activeTerminal?.type === 'agent';
  const status = activeTerminal?.status ?? 'idle';

  const Icon = isAgent ? Bot : TerminalIcon;

  return (
    <NotificationRing active={needsAttention}>
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors rounded-r-md
          ${isActive
            ? 'bg-[#1a1a1a] border-l-2 border-[#3b82f6]'
            : 'border-l-2 border-transparent hover:bg-[#1a1a1a]/50'
          }
        `}
        title={workspace.name}
      >
        <Icon size={16} className="shrink-0 text-[#737373]" />

        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <div className="truncate text-[#e5e5e5] text-[13px]">
                {workspace.name}
              </div>
              {activeTerminal?.gitBranch && (
                <div className="truncate text-[11px] text-[#737373]">
                  {activeTerminal.gitBranch}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <div className={`w-1.5 h-1.5 rounded-full ${statusColor(status)}`} />
              <NotificationBadge count={totalUnread} />
            </div>
          </>
        )}
      </button>
    </NotificationRing>
  );
}
