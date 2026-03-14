/**
 * Tool: spawn_codex
 * Spawns a Codex CLI process for a given task, optionally in an isolated git worktree.
 */

import { spawn } from '../codex/spawner.js';
import { validateFileScope } from '../codex/validator.js';
import type { SpawnCodexToolInput, SpawnCodexOutput } from '../types.js';

/**
 * Spawn a Codex CLI process to handle a task.
 *
 * @param input - The spawn parameters including prompt, worktreePath, and timeout
 * @returns The result of the Codex execution including modified files and JSONL event count
 */
export async function spawnCodex(input: SpawnCodexToolInput): Promise<SpawnCodexOutput> {
  // 1. Call spawner with input
  const result = await spawn(input);

  // 2. Run file scope validation
  const validation = validateFileScope(result.filesModified, input.denyList);
  result.deniedFiles = validation.deniedFiles;

  // 3. If denied files found, mark as not fully successful
  if (!validation.passed) {
    result.success = false;
  }

  return result;
}
