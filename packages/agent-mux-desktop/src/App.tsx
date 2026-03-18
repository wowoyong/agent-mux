import { Plus, Zap } from 'lucide-react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { WorkspaceView } from './components/Workspace/Workspace';
import { InputBar } from './components/InputBar/InputBar';
import { StatusBar } from './components/StatusBar/StatusBar';
import { useKeyboard } from './hooks/useKeyboard';
import { useWorkspaceStore } from './stores/workspaceStore';

function App() {
  useKeyboard();

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const hasWorkspaces = workspaces.length > 0;

  return (
    <div className="flex h-screen w-screen bg-[#0a0a0a] overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Workspace area */}
        {hasWorkspaces ? (
          <WorkspaceView />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <Zap size={40} className="text-[#3b82f6] mx-auto" />
              <h2 className="text-lg font-semibold text-[#e5e5e5]">
                Welcome to Agent Mux
              </h2>
              <p className="text-sm text-[#737373] max-w-sm">
                AI agent multiplexer for terminal workflows. Create a workspace to get started.
              </p>
              <button
                onClick={() => createWorkspace()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#3b82f6] text-white rounded-lg text-sm font-medium hover:bg-[#2563eb] transition-colors"
              >
                <Plus size={16} />
                Create Workspace
              </button>
            </div>
          </div>
        )}

        {/* Input bar */}
        <InputBar />

        {/* Status bar */}
        <StatusBar />
      </div>
    </div>
  );
}

export default App;
