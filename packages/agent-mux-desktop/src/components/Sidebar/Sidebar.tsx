import { Plus, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { WorkspaceTab } from './WorkspaceTab';
import { BudgetBar } from './BudgetBar';

export function Sidebar() {
  const {
    workspaces,
    activeWorkspaceId,
    sidebarCollapsed,
    setActiveWorkspace,
    createWorkspace,
    toggleSidebar,
  } = useWorkspaceStore();

  return (
    <div
      className="flex flex-col h-full bg-[#111111] border-r border-[#262626] transition-all duration-200"
      style={{ width: sidebarCollapsed ? 48 : 220 }}
    >
      {/* Logo area */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-[#262626]">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-[#3b82f6]" />
            <span className="text-[13px] font-semibold text-[#e5e5e5]">
              Agent Mux
            </span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-[#262626] text-[#737373] transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Workspace list */}
      <div className="flex-1 overflow-y-auto py-1">
        {workspaces.map((ws) => (
          <WorkspaceTab
            key={ws.id}
            workspace={ws}
            isActive={ws.id === activeWorkspaceId}
            collapsed={sidebarCollapsed}
            onClick={() => setActiveWorkspace(ws.id)}
          />
        ))}
      </div>

      {/* New workspace button */}
      <div className="px-2 py-1 border-t border-[#262626]">
        <button
          onClick={() => createWorkspace()}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-[#737373] hover:text-[#e5e5e5] hover:bg-[#262626] transition-colors text-[12px]"
        >
          <Plus size={14} />
          {!sidebarCollapsed && <span>New Workspace</span>}
        </button>
      </div>

      {/* Budget bars */}
      {!sidebarCollapsed && (
        <div className="border-t border-[#262626]">
          <BudgetBar />
        </div>
      )}
    </div>
  );
}
