import { useCallback, useRef } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';

interface PaneDividerProps {
  workspaceId: string;
  paneId: string;
  direction: 'horizontal' | 'vertical';
}

export function PaneDivider({ workspaceId, paneId, direction }: PaneDividerProps) {
  const resizePane = useWorkspaceStore((s) => s.resizePane);
  const dragging = useRef(false);
  const startPos = useRef(0);
  const startRatio = useRef(0.5);
  const containerSize = useRef(0);

  const isHorizontal = direction === 'horizontal';

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startPos.current = isHorizontal ? e.clientX : e.clientY;

      const parent = (e.target as HTMLElement).parentElement;
      if (parent) {
        containerSize.current = isHorizontal
          ? parent.offsetWidth
          : parent.offsetHeight;
      }

      // Get current ratio from store
      const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === workspaceId);
      if (ws) {
        const findRatio = (p: typeof ws.panes): number => {
          if (p.id === paneId) return p.ratio ?? 0.5;
          if (p.children) {
            const left = findRatio(p.children[0]);
            if (left !== -1) return left;
            return findRatio(p.children[1]);
          }
          return -1;
        };
        const ratio = findRatio(ws.panes);
        startRatio.current = ratio !== -1 ? ratio : 0.5;
      }

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = (isHorizontal ? ev.clientX : ev.clientY) - startPos.current;
        const ratioDelta = containerSize.current > 0 ? delta / containerSize.current : 0;
        const newRatio = Math.max(0.1, Math.min(0.9, startRatio.current + ratioDelta));
        resizePane(workspaceId, paneId, newRatio);
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [workspaceId, paneId, direction, resizePane, isHorizontal]
  );

  return (
    <div
      onMouseDown={onMouseDown}
      className={`shrink-0 bg-[#262626] hover:bg-[#3b82f6] transition-colors ${
        isHorizontal
          ? 'w-[2px] hover:w-[6px] cursor-col-resize'
          : 'h-[2px] hover:h-[6px] cursor-row-resize'
      }`}
    />
  );
}
