import { useRef, useEffect } from 'react';
import { X, Bot, Terminal as TerminalIcon } from 'lucide-react';
import { useTerminal } from '../../hooks/useTerminal';
import { useWorkspaceStore, type Terminal as TerminalType } from '../../stores/workspaceStore';
import { spawnPty, writePty, resizePty, killPty, onPtyOutput } from '../../lib/tauri-commands';

interface TerminalPaneProps {
  terminal: TerminalType;
  workspaceId: string;
  paneId: string;
  isActive: boolean;
}

export function TerminalPane({ terminal, workspaceId, paneId, isActive }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ptyIdRef = useRef<string | null>(null);
  const { terminal: xtermRef, fitAddon, write, focus } = useTerminal(containerRef);
  const { setActiveTerminal, closePane } = useWorkspaceStore();

  useEffect(() => {
    if (!xtermRef.current) return;

    let unlisten: (() => void) | null = null;
    let cancelled = false;

    async function init() {
      try {
        const id = await spawnPty(terminal.cwd);
        if (cancelled) {
          await killPty(id);
          return;
        }
        ptyIdRef.current = id;

        // Listen for PTY output
        const unlistenFn = await onPtyOutput(id, (data) => {
          write(data);
        });
        unlisten = unlistenFn;

        // Forward terminal input to PTY
        xtermRef.current?.onData((data: string) => {
          if (ptyIdRef.current) writePty(ptyIdRef.current, data);
        });

        // Forward resize events
        xtermRef.current?.onResize(({ cols, rows }: { cols: number; rows: number }) => {
          if (ptyIdRef.current) resizePty(ptyIdRef.current, cols, rows);
        });

        // Initial resize
        if (fitAddon.current) {
          fitAddon.current.fit();
          const dims = fitAddon.current.proposeDimensions();
          if (dims && ptyIdRef.current) {
            await resizePty(ptyIdRef.current, dims.cols, dims.rows);
          }
        }

        // Auto-run initial command (e.g. "mux")
        if (terminal.initialCommand && ptyIdRef.current) {
          // Small delay for shell to initialize
          setTimeout(() => {
            if (ptyIdRef.current) {
              writePty(ptyIdRef.current, terminal.initialCommand + '\n');
            }
          }, 500);
        }
      } catch {
        // Tauri commands not available in dev mode without backend
        write('\r\n\x1b[33m[PTY not available - Tauri backend required]\x1b[0m\r\n');
        write('\x1b[90m$ \x1b[0m');
      }
    }

    init();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
      if (ptyIdRef.current) {
        killPty(ptyIdRef.current).catch(() => {});
        ptyIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isActive) focus();
  }, [isActive, focus]);

  const Icon = terminal.type === 'agent' ? Bot : TerminalIcon;
  const agentColor = terminal.agentType === 'claude' ? '#d97706' : terminal.agentType === 'codex' ? '#8b5cf6' : '#3b82f6';

  return (
    <div
      className={`flex flex-col h-full bg-[#0a0a0a] ${
        isActive ? 'border-t-2 border-[#3b82f6]' : 'border-t-2 border-transparent'
      }`}
      onClick={() => setActiveTerminal(workspaceId, terminal.id)}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between h-7 px-2 bg-[#111111] border-b border-[#262626] shrink-0">
        <div className="flex items-center gap-1.5">
          <Icon size={12} style={{ color: terminal.type === 'agent' ? agentColor : '#737373' }} />
          <span className="text-[11px] text-[#e5e5e5] truncate max-w-[200px]">
            {terminal.title}
          </span>
          {terminal.type === 'agent' && terminal.agentType && (
            <span
              className="text-[9px] px-1 py-0.5 rounded font-medium"
              style={{ backgroundColor: agentColor + '20', color: agentColor }}
            >
              {terminal.agentType}
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            closePane(workspaceId, paneId);
          }}
          className="p-0.5 rounded hover:bg-[#262626] text-[#737373] hover:text-[#e5e5e5] transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Terminal container */}
      <div
        ref={containerRef}
        className="xterm-container flex-1 min-h-0 select-text"
        onClick={() => focus()}
      />
    </div>
  );
}
