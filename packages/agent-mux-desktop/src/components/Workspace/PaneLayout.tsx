import type { Pane, Workspace } from '../../stores/workspaceStore';
import { TerminalPane } from '../Terminal/TerminalPane';
import { PaneDivider } from './PaneDivider';

interface PaneLayoutProps {
  pane: Pane;
  workspace: Workspace;
}

export function PaneLayout({ pane, workspace }: PaneLayoutProps) {
  // Leaf node: render terminal
  if (!pane.children || !pane.direction) {
    const terminal = workspace.terminals.find((t) => t.id === pane.terminalId);
    if (!terminal) return null;

    return (
      <TerminalPane
        terminal={terminal}
        workspaceId={workspace.id}
        paneId={pane.id}
        isActive={terminal.id === workspace.activeTerminalId}
      />
    );
  }

  // Split node: render children with divider
  const isHorizontal = pane.direction === 'horizontal';
  const ratio = pane.ratio ?? 0.5;
  const firstPercent = `${ratio * 100}%`;
  const secondPercent = `${(1 - ratio) * 100}%`;

  return (
    <div className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} h-full w-full`}>
      <div style={{ flexBasis: firstPercent, flexGrow: 0, flexShrink: 0 }} className="min-w-0 min-h-0 overflow-hidden">
        <PaneLayout pane={pane.children[0]} workspace={workspace} />
      </div>
      <PaneDivider
        workspaceId={workspace.id}
        paneId={pane.id}
        direction={pane.direction}
      />
      <div style={{ flexBasis: secondPercent, flexGrow: 0, flexShrink: 0 }} className="min-w-0 min-h-0 overflow-hidden">
        <PaneLayout pane={pane.children[1]} workspace={workspace} />
      </div>
    </div>
  );
}
