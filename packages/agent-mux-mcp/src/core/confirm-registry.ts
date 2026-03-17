/**
 * Confirm Back-Channel Registry
 * Decouples codex-stream.ts from engine.ts to avoid circular imports.
 * The engine registers waitForConfirm resolvers here;
 * codex-stream reads them via waitForConfirm().
 */

const pending = new Map<string, (choice: string) => void>();

/**
 * Register a pending confirmation and return a Promise that resolves
 * when resolve() is called with the user's choice.
 */
export function registerConfirm(id: string): Promise<string> {
  return new Promise((resolve) => {
    pending.set(id, resolve);
  });
}

/**
 * Resolve a pending confirmation with the user's choice.
 * Called by MuxEngineImpl.respondToConfirm().
 */
export function resolveConfirm(id: string, choice: string): boolean {
  const resolver = pending.get(id);
  if (resolver) {
    resolver(choice);
    pending.delete(id);
    return true;
  }
  return false;
}

/**
 * Wait for a confirm event to be resolved.
 * Used by codex-stream.ts to suspend the generator.
 * If no confirm is pending for this id, resolves immediately with 'no'.
 */
export function waitForConfirm(id: string): Promise<string> {
  const existing = pending.get(id);
  if (existing) {
    // Already registered — create a new promise that wraps the existing entry
    return new Promise((resolve) => {
      pending.set(id, (choice) => {
        resolve(choice);
      });
    });
  }
  // Auto-register so codex-stream can always await
  return registerConfirm(id);
}
