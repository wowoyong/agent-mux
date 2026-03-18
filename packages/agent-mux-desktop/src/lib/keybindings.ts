type KeyHandler = () => void;

export interface Binding {
  key: string;
  meta?: boolean;
  shift?: boolean;
  ctrl?: boolean;
  handler: KeyHandler;
}

export function setupKeybindings(bindings: Binding[]): () => void {
  const listener = (e: KeyboardEvent) => {
    for (const b of bindings) {
      const metaMatch = b.meta ? e.metaKey : !e.metaKey;
      const shiftMatch = b.shift ? e.shiftKey : !e.shiftKey;
      const ctrlMatch = b.ctrl ? e.ctrlKey : !e.ctrlKey;
      if (
        e.key.toLowerCase() === b.key.toLowerCase() &&
        metaMatch &&
        shiftMatch &&
        ctrlMatch
      ) {
        // Don't intercept when typing in input
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        b.handler();
        return;
      }
    }
  };
  window.addEventListener('keydown', listener);
  return () => window.removeEventListener('keydown', listener);
}
