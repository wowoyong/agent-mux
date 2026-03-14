/**
 * Git Worktree Manager
 * Creates, removes, and manages git worktrees for isolated Codex execution.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const execAsync = promisify(execFile);

/**
 * Create a new git worktree at the given path with a new branch from HEAD.
 */
export async function createWorktree(path: string, branch: string): Promise<void> {
  await execAsync('git', ['worktree', 'add', '-b', branch, path, 'HEAD']);
}

/**
 * Remove a git worktree.
 */
export async function removeWorktree(path: string, force = false): Promise<void> {
  const args = ['worktree', 'remove'];
  if (force) args.push('--force');
  args.push(path);
  await execAsync('git', args);
}

/**
 * Merge a branch into the current branch with a no-fast-forward merge.
 */
export async function mergeWorktree(branch: string, message: string): Promise<void> {
  await execAsync('git', ['merge', branch, '--no-ff', '-m', message]);
}

/**
 * Force-remove a worktree, delete the branch, and prune stale worktree metadata.
 */
export async function cleanupWorktree(path: string, branch: string): Promise<void> {
  try {
    await removeWorktree(path, true);
  } catch {
    // Worktree may already be removed
  }
  try {
    await execAsync('git', ['branch', '-D', branch]);
  } catch {
    // Branch may already be deleted
  }
  await execAsync('git', ['worktree', 'prune']);
}

/**
 * Find and clean up stale codex worktrees in .codex-worktrees/.
 * Returns the number of worktrees that were cleaned up.
 */
export async function cleanupStaleWorktrees(): Promise<number> {
  const worktreeDir = '.codex-worktrees';
  let entries: string[];

  try {
    entries = await readdir(worktreeDir);
  } catch {
    // Directory doesn't exist — nothing to clean
    return 0;
  }

  let cleaned = 0;

  for (const entry of entries) {
    if (!entry.startsWith('task-')) continue;

    const taskId = entry.replace('task-', '');
    const path = join(worktreeDir, entry);
    const branch = `codex/task-${taskId}`;

    try {
      await cleanupWorktree(path, branch);
      cleaned++;
    } catch {
      // Best-effort cleanup
    }
  }

  return cleaned;
}
