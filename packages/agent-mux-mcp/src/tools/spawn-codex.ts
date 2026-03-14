/**
 * Tool: spawn_codex
 * Spawns a Codex CLI process for a given task, optionally in an isolated git worktree.
 */

import type { SpawnCodexToolInput, SpawnCodexOutput } from '../types.js';

/**
 * Spawn a Codex CLI process to handle a task.
 *
 * @param input - The spawn parameters including prompt, workdir, and approval mode
 * @returns The result of the Codex execution including diff and modified files
 */
export async function spawnCodex(input: SpawnCodexToolInput): Promise<SpawnCodexOutput> {
  // TODO: Implement Codex CLI spawning
  throw new Error('Not implemented: spawnCodex');
}
