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
import { box, section, progressBar } from './ui.js';
import type { SubTask, RouteTarget } from '../types.js';

const execFile = promisify(execFileCb);

interface GoOptions {
  verbose?: boolean;
}

export async function goTask(taskDescription: string, options: GoOptions): Promise<void> {
  const config = await loadConfig();
  const budget = await getBudgetStatus();

  // Step 1: Try to decompose
  const decomposition = decomposeTask(taskDescription);

  if (decomposition.shouldDecompose && decomposition.subtasks.length > 1) {
    // Build decomposition box
    const decompLines: string[] = [
      'Decomposing task...',
      '',
    ];

    for (const sub of decomposition.subtasks) {
      const targetColor = sub.recommendedTarget === 'claude' ? chalk.blue : chalk.green;
      const targetName = sub.recommendedTarget === 'claude' ? 'Claude' : 'Codex';
      const desc = sub.description.slice(0, 34).padEnd(34);
      decompLines.push(
        `${chalk.white('#' + sub.id)}  ${desc} ${chalk.gray('\u2192')} ${targetColor.bold(targetName)}`
      );
    }

    decompLines.push('');
    decompLines.push(chalk.gray(`Strategy: ${decomposition.executionStrategy}`));

    console.log('\n' + box('mux go', decompLines));

    // Execute: Claude tasks first, then Codex tasks
    const claudeTasks = decomposition.subtasks.filter(s => s.recommendedTarget === 'claude');
    const codexTasks = decomposition.subtasks.filter(s => s.recommendedTarget === 'codex');

    const results: { id: string; desc: string; elapsed: number; files: number; success: boolean }[] = [];

    // Phase 1: Claude tasks (sequential)
    if (claudeTasks.length > 0) {
      console.log('\n' + section('Phase 1: Claude'));
      for (const task of claudeTasks) {
        const start = Date.now();
        await executeSubtask(task, 'claude', options);
        const elapsed = Math.round((Date.now() - start) / 1000);
        results.push({ id: task.id, desc: task.description.slice(0, 40), elapsed, files: 0, success: true });
      }
    }

    // Phase 2: Codex tasks (sequential for Plus tier, could be parallel for Pro)
    if (codexTasks.length > 0) {
      console.log('\n' + section('Phase 2: Codex'));
      for (const task of codexTasks) {
        const start = Date.now();
        const r = await executeSubtask(task, 'codex', options);
        const elapsed = Math.round((Date.now() - start) / 1000);
        results.push({ id: task.id, desc: task.description.slice(0, 40), elapsed, files: r.files, success: r.success });
      }
    }

    // Summary box
    const totalTasks = decomposition.subtasks.length;
    const completedTasks = results.filter(r => r.success).length;
    const totalFiles = results.reduce((sum, r) => sum + r.files, 0);
    const totalTime = results.reduce((sum, r) => sum + r.elapsed, 0);

    const updatedBudget = await getBudgetStatus();
    const limits = TIER_LIMITS[config.tier];
    const codexTotal = limits.codexTasksDay === Infinity ? '\u221e' : String(limits.codexTasksDay);

    const summaryLines = [
      `Tasks: ${completedTasks}/${totalTasks} complete`,
      `Files: ${totalFiles} modified`,
      `Time:  ${totalTime}s total`,
      '',
      `Claude  ${updatedBudget.claude.tasksCompleted}/${limits.claudeMsg5hr}  ${chalk.gray('\u2502')}  Codex  ${updatedBudget.codex.tasksCompleted}/${codexTotal}`,
    ];

    console.log('\n' + box('Summary', summaryLines) + '\n');

  } else {
    // Single task — route and execute directly
    const signals = analyzeTask(taskDescription);
    const claudePct = budget.claude.usagePercent / 100;
    const codexPct = budget.codex.usagePercent / 100;
    const decision = routeTask(signals, config.tier, claudePct, codexPct, taskDescription);

    const targetColor = decision.target === 'claude' ? chalk.blue : chalk.green;
    const targetName = decision.target === 'claude' ? 'Claude' : 'Codex';
    const confPct = Math.round(decision.confidence * 100);

    console.log(
      `\n  ${chalk.gray('\u2192')} ${targetColor.bold(targetName)}  ${chalk.gray(decision.reason)}  ${progressBar(confPct, 10)} ${chalk.gray(confPct + '%')}`
    );
    console.log();

    if (decision.target === 'codex') {
      await executeCodexGo(taskDescription);
    } else {
      await executeClaudeGo(taskDescription);
    }

    // Summary
    const updatedBudget = await getBudgetStatus();
    const limits = TIER_LIMITS[config.tier];
    const codexTotal = limits.codexTasksDay === Infinity ? '\u221e' : String(limits.codexTasksDay);

    const summaryLines = [
      `Claude  ${updatedBudget.claude.tasksCompleted}/${limits.claudeMsg5hr}  ${chalk.gray('\u2502')}  Codex  ${updatedBudget.codex.tasksCompleted}/${codexTotal}`,
    ];

    console.log('\n' + box('Complete', summaryLines) + '\n');
  }
}

async function executeSubtask(subtask: SubTask, target: RouteTarget, _options: GoOptions): Promise<{ success: boolean; files: number }> {
  if (target === 'codex') {
    const spinner = ora({
      text: `${subtask.description.slice(0, 50)}...`,
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
      const filesCount = result.finalResult.filesModified.length;
      spinner.succeed(`#${subtask.id}  ${subtask.description.slice(0, 40)}  ${chalk.gray(`(${elapsed}s, ${filesCount} files)`)}`);

      // Auto-apply: merge worktree
      if (result.finalResult.worktreePath && result.finalResult.branchName) {
        await autoMerge(result.finalResult.worktreePath, result.finalResult.branchName);
      }
      return { success: true, files: filesCount };
    } else {
      spinner.fail(`#${subtask.id}  ${subtask.description.slice(0, 40)}  ${chalk.red('FAILED')}`);
      if (result.escalatedToClaude) {
        console.log(chalk.yellow('    \u2192 Escalating to Claude...'));
        await executeClaudeGo(subtask.description);
      }
      return { success: false, files: 0 };
    }
  } else {
    // Claude task
    console.log(`  ${chalk.blue('\u2713')} #${subtask.id}  ${subtask.description.slice(0, 50)}`);
    console.log(chalk.blue('    Claude:'));
    const result = await spawnClaude(subtask.description, { stream: true });
    if (!result.success) {
      console.log(chalk.red(`    Error: ${result.error || 'Unknown'}`));
      return { success: false, files: 0 };
    }
    console.log();
    return { success: true, files: 0 };
  }
}

async function executeCodexGo(task: string): Promise<void> {
  const spinner = ora({ text: chalk.green('Codex working...'), spinner: 'dots' }).start();
  const start = Date.now();

  const result = await spawnWithRetry({ prompt: task, complexity: 'medium', timeout: 420_000 });
  const elapsed = Math.round((Date.now() - start) / 1000);

  if (result.finalResult.success) {
    spinner.succeed(chalk.green(`Complete \u2014 ${result.finalResult.filesModified.length} files (${elapsed}s)`));
    if (result.finalResult.worktreePath && result.finalResult.branchName) {
      await autoMerge(result.finalResult.worktreePath, result.finalResult.branchName);
    }
  } else {
    spinner.fail(chalk.red(`Failed (${elapsed}s)`));
    if (result.escalatedToClaude) {
      console.log(chalk.yellow('\n  \u2192 Escalating to Claude...'));
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
    console.log(chalk.gray('    \u2713 Changes merged'));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(chalk.yellow(`    \u26a0 Merge skipped: ${msg.slice(0, 50)}`));
  }
}
