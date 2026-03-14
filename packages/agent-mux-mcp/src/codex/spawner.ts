/**
 * Codex Spawner
 * Manages the lifecycle of Codex CLI processes including worktree creation and cleanup.
 */

import type { SpawnCodexInput, SpawnCodexOutput } from '../types.js';

/**
 * Spawn a Codex CLI process with the given configuration.
 *
 * @param input - Spawn configuration including prompt, workdir, and approval mode
 * @returns The output from the Codex process
 */
export async function spawn(input: SpawnCodexInput): Promise<SpawnCodexOutput> {
  // TODO: Implement Codex process spawning
  throw new Error('Not implemented: spawn');
}

/**
 * Create an isolated git worktree for Codex to work in.
 *
 * @param baseDir - The base repository directory
 * @param branch - Optional branch name for the worktree
 * @returns Path to the created worktree
 */
export async function createWorktree(baseDir: string, branch?: string): Promise<string> {
  // TODO: Implement worktree creation
  throw new Error('Not implemented: createWorktree');
}

/**
 * Clean up a git worktree after Codex completes.
 *
 * @param worktreePath - Path to the worktree to remove
 */
export async function cleanupWorktree(worktreePath: string): Promise<void> {
  // TODO: Implement worktree cleanup
  throw new Error('Not implemented: cleanupWorktree');
}
