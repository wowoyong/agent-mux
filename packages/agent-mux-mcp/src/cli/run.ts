import { createInterface } from 'node:readline';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import chalk from 'chalk';
import ora from 'ora';
import { analyzeTask, routeTask } from '../routing/classifier.js';
import { spawnWithRetry } from '../codex/retry.js';
import { loadConfig } from '../config/loader.js';
import { getBudgetStatus } from '../budget/tracker.js';
import { TIER_LIMITS } from '../config/tiers.js';
import { spawnClaude } from './claude-spawner.js';
import type { MuxConfig } from '../types.js';

const execAsync = promisify(execFile);

interface RunOptions {
  dryRun?: boolean;
  verbose?: boolean;
  route?: string;
  autoApply?: boolean;
  confirm?: boolean;
}

export async function runTask(taskDescription: string, options: RunOptions): Promise<void> {
  const config = await loadConfig();
  const budget = await getBudgetStatus();

  // Analyze task
  const signals = analyzeTask(taskDescription);

  // Get budget percentages
  const claudePct = budget.claude.usagePercent / 100;
  const codexPct = budget.codex.usagePercent / 100;

  // Route (or use forced route)
  let decision;
  if (options.route) {
    decision = {
      target: options.route as 'claude' | 'codex',
      confidence: 1.0,
      reason: `Forced route to ${options.route}`,
      signals,
      escalated: false,
    };
  } else {
    decision = routeTask(signals, config.tier, claudePct, codexPct, taskDescription);
  }

  // Display routing decision
  const targetColor = decision.target === 'claude' ? chalk.blue : chalk.green;
  console.log(
    chalk.gray('[agent-mux]'),
    'Routing →',
    targetColor.bold(decision.target.toUpperCase()),
    chalk.gray(`(${decision.reason}, confidence: ${Math.round(decision.confidence * 100)}%)`)
  );

  // Verbose mode: show signals
  if (options.verbose) {
    console.log(chalk.gray('\nSignals:'));
    for (const [key, value] of Object.entries(signals)) {
      if (typeof value === 'boolean' && value) {
        console.log(chalk.gray(`  + ${key}`));
      }
    }
    console.log();
  }

  // Dry run: stop here
  if (options.dryRun) {
    console.log(chalk.yellow('\n[DRY RUN] No execution performed.'));
    return;
  }

  // Execute based on routing
  if (decision.target === 'codex') {
    await executeCodex(taskDescription, config, options);
  } else {
    await executeClaude(taskDescription, options);
  }

  // Show budget after execution
  const updatedBudget = await getBudgetStatus();
  const limits = TIER_LIMITS[config.tier];
  console.log(
    chalk.gray('\n[agent-mux] Budget:'),
    chalk.blue(`Claude ${updatedBudget.claude.tasksCompleted}/${limits.claudeMsg5hr}`),
    chalk.gray('|'),
    chalk.green(`Codex ${updatedBudget.codex.tasksCompleted}/${limits.codexTasksDay === Infinity ? 'inf' : limits.codexTasksDay}`)
  );
}

async function executeCodex(task: string, _config: MuxConfig, options: RunOptions): Promise<void> {
  const spinner = ora({
    text: chalk.green('Codex working...'),
    spinner: 'dots',
  }).start();

  const startTime = Date.now();

  try {
    const result = await spawnWithRetry({
      prompt: task,
      complexity: 'medium',
      timeout: 420_000,
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);

    if (result.finalResult.success) {
      spinner.succeed(
        chalk.green(`Complete -- ${result.finalResult.filesModified.length} files modified (${elapsed}s)`)
      );

      // Show modified files
      if (result.finalResult.filesModified.length > 0) {
        console.log(chalk.gray('\nModified files:'));
        for (const f of result.finalResult.filesModified) {
          console.log(chalk.gray(`  ├── ${f}`));
        }
      }

      // Show diff preview
      if (result.finalResult.worktreePath && result.finalResult.filesModified.length > 0) {
        console.log(chalk.gray('\n--- Diff Preview ---'));
        const diff = await getDiff(result.finalResult.worktreePath);
        // Show truncated diff (max 50 lines)
        const diffLines = diff.split('\n');
        const preview = diffLines.slice(0, 50).join('\n');
        console.log(colorDiff(preview));
        if (diffLines.length > 50) {
          console.log(chalk.gray(`  ... (${diffLines.length - 50} more lines)`));
        }

        // Confirmation prompt (unless --auto-apply)
        if (!options.autoApply) {
          const answer = await askUser('\nApply changes? [y/n/d(full diff)] ');
          if (answer.toLowerCase() === 'd') {
            console.log(colorDiff(diff));
            const answer2 = await askUser('\nApply changes? [y/n] ');
            if (answer2.toLowerCase() !== 'y') {
              await rollback(result.finalResult.worktreePath, result.finalResult.branchName);
              console.log(chalk.yellow('Changes discarded.'));
              return;
            }
          } else if (answer.toLowerCase() !== 'y') {
            await rollback(result.finalResult.worktreePath, result.finalResult.branchName);
            console.log(chalk.yellow('Changes discarded.'));
            return;
          }
        }

        // Merge worktree
        await mergeAndCleanup(result.finalResult.worktreePath, result.finalResult.branchName);
        console.log(chalk.green('✓ Changes applied.'));
      }

      // Show retry info if any
      if (result.retryCount > 0) {
        console.log(chalk.yellow(`  (${result.retryCount} retry(s) needed)`));
      }
    } else {
      spinner.fail(chalk.red(`Failed after ${elapsed}s`));

      if (result.escalatedToClaude) {
        console.log(chalk.yellow('\n>> Escalating to Claude...'));
        await executeClaude(
          `Previous Codex attempt failed: ${result.escalationReason}\n\nOriginal task: ${task}`,
          options
        );
      } else {
        console.log(chalk.red(`Error: ${result.finalResult.stderr.slice(0, 200)}`));
      }
    }
  } catch (err: unknown) {
    spinner.fail(chalk.red('Codex execution failed'));
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(message));
  }
}

async function executeClaude(task: string, _options: RunOptions): Promise<void> {
  console.log(chalk.blue('\n  Claude:'));
  try {
    const result = await spawnClaude(task, { stream: true });
    if (!result.success && result.error) {
      console.error(chalk.red('\n  Error: ' + result.error));
    }
    console.log(); // newline after streaming
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red('\n  Error: ' + message));
  }
}

// ─── Diff Utilities ──────────────────────────────────────────────────

/** Colorize a unified diff for terminal output */
function colorDiff(diff: string): string {
  return diff.split('\n').map(line => {
    if (line.startsWith('+') && !line.startsWith('+++')) return chalk.green(line);
    if (line.startsWith('-') && !line.startsWith('---')) return chalk.red(line);
    if (line.startsWith('@@')) return chalk.cyan(line);
    return chalk.gray(line);
  }).join('\n');
}

/** Get unified diff from a worktree */
async function getDiff(worktreePath: string): Promise<string> {
  try {
    const { stdout } = await execAsync('git', ['diff', 'HEAD'], { cwd: worktreePath });
    return stdout;
  } catch {
    return '(unable to generate diff)';
  }
}

/** Ask user a question via stdin/stdout */
function askUser(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question(question, (a) => { rl.close(); r(a); }));
}

/** Merge worktree branch into current branch and cleanup */
async function mergeAndCleanup(worktreePath: string, branchName: string): Promise<void> {
  try {
    await execAsync('git', ['merge', branchName, '--no-ff', '-m', 'mux: merge codex task']);
    await execAsync('git', ['worktree', 'remove', worktreePath]);
    await execAsync('git', ['branch', '-d', branchName]);
  } catch {
    // Best-effort cleanup
  }
}

/** Rollback worktree: force-remove worktree and delete branch */
async function rollback(worktreePath: string, branchName: string): Promise<void> {
  try {
    await execAsync('git', ['worktree', 'remove', '--force', worktreePath]);
    await execAsync('git', ['branch', '-D', branchName]);
  } catch {
    // Best-effort cleanup
  }
}
