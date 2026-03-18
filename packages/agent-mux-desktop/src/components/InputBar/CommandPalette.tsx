import { useState, useEffect, useCallback } from 'react';

interface Command {
  name: string;
  description: string;
}

const COMMANDS: Command[] = [
  { name: '/route', description: 'Route task to best agent' },
  { name: '/status', description: 'Show agent status' },
  { name: '/split-h', description: 'Split pane horizontally' },
  { name: '/split-v', description: 'Split pane vertically' },
  { name: '/close', description: 'Close current pane' },
  { name: '/clear', description: 'Clear terminal output' },
];

interface CommandPaletteProps {
  filter: string;
  onSelect: (command: string) => void;
  onClose: () => void;
}

export function CommandPalette({ filter, onSelect, onClose }: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = COMMANDS.filter((cmd) =>
    cmd.name.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex].name);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, selectedIndex, onSelect, onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 mx-2 bg-[#1a1a1a] border border-[#262626] rounded-lg shadow-lg overflow-hidden z-50">
      {filtered.map((cmd, i) => (
        <button
          key={cmd.name}
          onClick={() => onSelect(cmd.name)}
          className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${
            i === selectedIndex
              ? 'bg-[#262626] text-[#e5e5e5]'
              : 'text-[#737373] hover:bg-[#262626]/50'
          }`}
        >
          <span className="font-mono text-[12px]">{cmd.name}</span>
          <span className="text-[11px] text-[#737373]">{cmd.description}</span>
        </button>
      ))}
    </div>
  );
}
