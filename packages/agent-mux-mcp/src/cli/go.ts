import chalk from 'chalk';
import ora from 'ora';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { analyzeTask, routeTask } from '../routing/classifier.js';
import { decomposeTask } from '../routing/decomposer.js';
import { spawnWithRetry } from '../codex/retry.js';
import { loadConfig } from '../config/loader.js';
import { getBudgetStatus } from '../budget/tracker.js';
import { spawnClaude } from './claude-spawner.js';
import { TIER_LIMITS } from '../config/tiers.js';
import type { SubTask, RouteTarget } from '../types.js';

const execFile = promisify(execFileCb);

interface GoOptions {
  verbose?: boolean;
}

export async function goTask(taskDescription: string, options: GoOptions): Promise<void> {
  const config = await loadConfig();
  const budget = await getBudgetStatus();

  console.log(chalk.bold('\n⚡ mux go — auto-routing + auto-execution\n'));

  // Step 1: Try to decompose
  const decomposition = decomposeTask(taskDescription);

  if (decomposition.shouldDecompose && decomposition.subtasks.length > 1) {
    console.log(chalk.gray(`Decomposed into ${decomposition.subtasks.length} subtasks (${decomposition.executionStrategy}):\n`));

    for (const sub of decomposition.subtasks) {
      const icon = sub.recommendedTarget === 'claude' ? chalk.blue('◆') : chalk.green('◆');
      console.log(`  ${icon} [${sub.id}] ${sub.description.slice(0, 60)} → ${sub.recommendedTarget.toUpperCase()}`);
    }
    console.log();

    // Execute: Claude tasks first, then Codex tasks
    const claudeTasks = decomposition.subtasks.filter(s => s.recommendedTarget === 'claude');
    const codexTasks = decomposition.subtasks.filter(s => s.recommendedTarget === 'codex');

    // Phase 1: Claude tasks (sequential)
    if (claudeTasks.length > 0) {
      console.log(chalk.blue.bold('Phase 1: Claude tasks\n'));
      for (const task of claudeTasks) {
        await executeSubtask(task, 'claude', options);
      }
    }

    // Phase 2: Codex tasks (sequential for Plus tier, could be parallel for Pro)
    if (codexTasks.length > 0) {
      console.log(chalk.green.bold('\nPhase 2: Codex tasks\n'));
      for (const task of codexTasks) {
        await executeSubtask(task, 'codex', options);
      }
    }

  } else {
    // Single task — route and execute directly
    const signals = analyzeTask(taskDescription);
    const claudePct = budget.claude.usagePercent / 100;
    const codexPct = budget.codex.usagePercent / 100;
    const decision = routeTask(signals, config.tier, claudePct, codexPct, taskDescription);

    const targetColor = decision.target === 'claude' ? chalk.blue : chalk.green;
    console.log(
      chalk.gray('[routing]'),
      targetColor.bold(decision.target.toUpperCase()),
      chalk.gray(`(${decision.reason})`)
    );
    console.log();

    if (decision.target === 'codex') {
      await executeCodexGo(taskDescription);
    } else {
      await executeClaudeGo(taskDescription);
    }
  }

  // Summary
  const updatedBudget = await getBudgetStatus();
  const limits = TIER_LIMITS[config.tier];
  console.log(chalk.bold('\n═══ Complete ═══'));
  console.log(
    chalk.gray('Budget:'),
    chalk.blue(`Claude ${updatedBudget.claude.tasksCompleted}/${limits.claudeMsg5hr}`),
    chalk.gray('|'),
    chalk.green(`Codex ${updatedBudget.codex.tasksCompleted}/${limits.codexTasksDay === Infinity ? '∞' : limits.codexTasksDay}`)
  );
  console.log();
}

async function executeSubtask(subtask: SubTask, target: RouteTarget, _options: GoOptions): Promise<void> {
  const prefix = target === 'claude' ? chalk.blue('◆') : chalk.green('◆');

  if (target === 'codex') {
    const spinner = ora({
      text: `${subtask.description.slice(0, 50)}...`,
      prefixText: prefix,
      spinner: 'dots',
    }).start();

    const start = Date.now();
    const result = await spawnWithRetry({
      prompt: subtask.description,
      complexity: 'medium',
      timeout: 420_000,
    });
    const elapsed = Math.round((Date.now() - start) / 1000);

    if (result.finalResult.success) {
      spinner.succeed(`${subtask.description.slice(0, 50)} (${elapsed}s, ${result.finalResult.filesModified.length} files)`);

      // Auto-apply: merge worktree
      if (result.finalResult.worktreePath && result.finalResult.branchName) {
        await autoMerge(result.finalResult.worktreePath, result.finalResult.branchName);
      }
    } else {
      spinner.fail(`${subtask.description.slice(0, 50)} — FAILED`);
      if (result.escalatedToClaude) {
        console.log(chalk.yellow('    ↳ Escalating to Claude...'));
        await executeClaudeGo(subtask.description);
      }
    }
  } else {
    // Claude task
    console.log(`${prefix} ${subtask.description.slice(0, 60)}`);
    console.log(chalk.blue('  Claude:'));
    const result = await spawnClaude(subtask.description, { stream: true });
    if (!result.success) {
      console.log(chalk.red(`  Error: ${result.error || 'Unknown'}`));
    }
    console.log();
  }
}

async function executeCodexGo(task: string): Promise<void> {
  const spinner = ora({ text: chalk.green('Codex working...'), spinner: 'dots' }).start();
  const start = Date.now();

  const result = await spawnWithRetry({ prompt: task, complexity: 'medium', timeout: 420_000 });
  const elapsed = Math.round((Date.now() - start) / 1000);

  if (result.finalResult.success) {
    spinner.succeed(chalk.green(`Complete — ${result.finalResult.filesModified.length} files (${elapsed}s)`));
    if (result.finalResult.worktreePath && result.finalResult.branchName) {
      await autoMerge(result.finalResult.worktreePath, result.finalResult.branchName);
    }
  } else {
    spinner.fail(chalk.red(`Failed (${elapsed}s)`));
    if (result.escalatedToClaude) {
      console.log(chalk.yellow('\n⚡ Escalating to Claude...'));
      await executeClaudeGo(task);
    }
  }
}

async function executeClaudeGo(task: string): Promise<void> {
  console.log(chalk.blue('\n  Claude:'));
  await spawnClaude(task, { stream: true });
  console.log();
}

async function autoMerge(worktreePath: string, branchName: string): Promise<void> {
  try {
    await execFile('git', ['merge', branchName, '--no-ff', '-m', 'mux: auto-merge codex task']);
    await execFile('git', ['worktree', 'remove', worktreePath]);
    await execFile('git', ['branch', '-d', branchName]);
    console.log(chalk.gray('    ✓ Changes merged'));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(chalk.yellow(`    ⚠ Merge skipped: ${msg.slice(0, 50)}`));
  }
}
