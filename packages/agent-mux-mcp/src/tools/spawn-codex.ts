/**
 * Tool: spawn_codex
 * Spawns a Codex CLI process for a given task with automatic retry and escalation.
 */

import { spawnWithRetry } from '../codex/retry.js';
import type { SpawnCodexToolInput, EscalationResult } from '../types.js';

/**
 * Spawn a Codex CLI process to handle a task, with retry chain and escalation.
 *
 * @param input - The spawn parameters including prompt, worktreePath, and timeout
 * @returns The escalation result including retry history and final outcome
 */
export async function spawnCodex(input: SpawnCodexToolInput): Promise<EscalationResult> {
  return spawnWithRetry(input);
}
