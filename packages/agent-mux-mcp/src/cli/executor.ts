import chalk from 'chalk';
import ora from 'ora';
import { spawnWithRetry } from '../codex/retry.js';
import { spawnClaude } from './claude-spawner.js';
import { mergeWorktree, cleanupWorktree, removeWorktree } from '../codex/worktree.js';
import { CODEX_TIMEOUT_MEDIUM } from '../constants.js';
import type { EscalationResult } from '../types.js';

export interface ExecutionOptions {
  autoApply?: boolean;
  stream?: boolean;
  showDiff?: boolean;
  showConfirmation?: boolean;
}

/**
 * Execute a task on Codex with retry support.
 * Returns the escalation result for further handling (diff, merge, etc.).
 */
export async function executeOnCodex(
  task: string,
  options?: ExecutionOptions
): Promise<{ result: EscalationResult; spinner: ReturnType<typeof ora>; elapsed: number }> {
  const spinner = ora({ text: chalk.green('Codex working...'), spinner: 'dots' }).start();
  const start = Date.now();

  const result = await spawnWithRetry({
    prompt: task,
    complexity: 'medium',
    timeout: CODEX_TIMEOUT_MEDIUM,
  });

  const elapsed = Math.round((Date.now() - start) / 1000);

  if (result.finalResult.success) {
    spinner.succeed(chalk.green(
      `Complete \u2014 ${result.finalResult.filesModified.length} files modified (${elapsed}s)`
    ));
  } else {
    spinner.fail(chalk.red(`Failed (${elapsed}s)`));
  }

  return { result, spinner, elapsed };
}

/**
 * Execute a task on Claude in streaming mode.
 */
export async function executeOnClaude(
  task: string,
  options?: ExecutionOptions
): Promise<{ success: boolean; error?: string }> {
  console.log(chalk.blue('\n  Claude:'));
  try {
    const result = await spawnClaude(task, { stream: options?.stream !== false });
    if (!result.success && result.error) {
      console.error(chalk.red('\n  Error: ' + result.error));
    }
    console.log();
    return { success: result.success, error: result.error };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red('\n  Error: ' + message));
    return { success: false, error: message };
  }
}

/**
 * Merge worktree changes into the current branch and clean up.
 */
export async function applyWorktreeChanges(
  worktreePath: string,
  branchName: string,
  taskSummary: string
): Promise<void> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(execFile);

  try {
    await mergeWorktree(branchName, `mux: ${taskSummary}`);
    await removeWorktree(worktreePath);
    await execAsync('git', ['branch', '-d', branchName]);
    console.log(chalk.gray('    \u2713 Changes applied'));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(chalk.yellow(`    \u26a0 Merge failed: ${msg.slice(0, 50)}`));
  }
}

/**
 * Discard worktree changes — force-remove worktree and delete branch.
 */
export async function rollbackWorktree(
  worktreePath: string,
  branchName: string
): Promise<void> {
  await cleanupWorktree(worktreePath, branchName);
  console.log(chalk.yellow('    Changes discarded'));
}
