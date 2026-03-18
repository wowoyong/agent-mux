import { useState, useRef, useCallback } from 'react';
import { Send, ChevronDown } from 'lucide-react';
import { CommandPalette } from './CommandPalette';
import { useAgentStore } from '../../stores/agentStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';

type AgentChoice = 'auto' | 'claude' | 'codex';

export function InputBar() {
  const [input, setInput] = useState('');
  const [agentChoice, setAgentChoice] = useState<AgentChoice>('auto');
  const [showPalette, setShowPalette] = useState(false);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const createSession = useAgentStore((s) => s.createSession);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('/')) {
      // Handle command
      handleCommand(trimmed);
    } else {
      // Create agent session
      const ws = workspaces.find((w) => w.id === activeWorkspaceId);
      if (ws) {
        createSession(ws.activeTerminalId, trimmed, agentChoice);
      }
    }

    setInput('');
    setShowPalette(false);
  }, [input, agentChoice, activeWorkspaceId, workspaces, createSession]);

  const handleCommand = (command: string) => {
    const ws = workspaces.find((w) => w.id === activeWorkspaceId);
    if (!ws) return;

    const { splitPane, closePane } = useWorkspaceStore.getState();

    switch (command) {
      case '/split-h':
        splitPane(ws.id, ws.panes.id, 'horizontal');
        break;
      case '/split-v':
        splitPane(ws.id, ws.panes.id, 'vertical');
        break;
      case '/close':
        closePane(ws.id, ws.panes.id);
        break;
      default:
        break;
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    setShowPalette(value.startsWith('/'));
  };

  const agentColors: Record<AgentChoice, string> = {
    auto: '#3b82f6',
    claude: '#d97706',
    codex: '#8b5cf6',
  };

  return (
    <div className="relative bg-[#111111] border-t border-[#262626] px-2 py-2">
      {showPalette && (
        <CommandPalette
          filter={input}
          onSelect={(cmd) => {
            setInput(cmd);
            setShowPalette(false);
            handleCommand(cmd);
            setInput('');
          }}
          onClose={() => setShowPalette(false)}
        />
      )}

      <div className="flex items-center gap-2">
        {/* Agent selector */}
        <div className="relative">
          <button
            onClick={() => setShowAgentMenu(!showAgentMenu)}
            className="flex items-center gap-1 px-2 py-1.5 rounded text-[12px] font-medium border border-[#262626] hover:border-[#333] transition-colors"
            style={{ color: agentColors[agentChoice] }}
          >
            {agentChoice}
            <ChevronDown size={12} />
          </button>

          {showAgentMenu && (
            <div className="absolute bottom-full left-0 mb-1 bg-[#1a1a1a] border border-[#262626] rounded-lg shadow-lg overflow-hidden z-50">
              {(['auto', 'claude', 'codex'] as const).map((choice) => (
                <button
                  key={choice}
                  onClick={() => {
                    setAgentChoice(choice);
                    setShowAgentMenu(false);
                  }}
                  className={`w-full px-3 py-1.5 text-[12px] text-left hover:bg-[#262626] transition-colors ${
                    agentChoice === choice ? 'bg-[#262626]' : ''
                  }`}
                  style={{ color: agentColors[choice] }}
                >
                  {choice}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input field */}
        <input
          ref={inputRef}
          data-input-bar
          type="text"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !showPalette) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Ask an agent..."
          className="flex-1 bg-transparent text-[#e5e5e5] text-[13px] placeholder-[#737373] outline-none font-mono"
        />

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className="p-1.5 rounded hover:bg-[#262626] text-[#737373] hover:text-[#3b82f6] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
