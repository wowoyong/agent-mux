import chalk from 'chalk';
import { analyzeTask, routeTask } from '../routing/classifier.js';
import { decomposeTask } from '../routing/decomposer.js';
import { loadConfig } from '../config/loader.js';
import { getBudgetStatus } from '../budget/tracker.js';
import { spawnClaude } from './claude-spawner.js';
import { TIER_LIMITS } from '../config/tiers.js';
import { executeOnCodex, executeOnClaude, applyWorktreeChanges } from './executor.js';
import { box, section, progressBar } from './ui.js';
import type { SubTask, RouteTarget } from '../types.js';

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
        await executeSubtask(task, 'claude');
        const elapsed = Math.round((Date.now() - start) / 1000);
        results.push({ id: task.id, desc: task.description.slice(0, 40), elapsed, files: 0, success: true });
      }
    }

    // Phase 2: Codex tasks (parallel for Power tier, sequential otherwise)
    if (codexTasks.length > 0) {
      const limits = TIER_LIMITS[config.tier];
      const concurrent = limits.concurrent;

      if (concurrent > 1 && codexTasks.length > 1) {
        console.log('\n' + section(`Phase 2: Codex (${Math.min(concurrent, codexTasks.length)} concurrent)`));

        // Process in batches of `concurrent`
        for (let i = 0; i < codexTasks.length; i += concurrent) {
          const batch = codexTasks.slice(i, i + concurrent);
          const batchResults = await Promise.allSettled(
            batch.map(async (task) => {
              const start = Date.now();
              const r = await executeSubtask(task, 'codex');
              const elapsed = Math.round((Date.now() - start) / 1000);
              return { id: task.id, desc: task.description.slice(0, 40), elapsed, files: r.files, success: r.success };
            })
          );
          for (const br of batchResults) {
            if (br.status === 'fulfilled') {
              results.push(br.value);
            } else {
              results.push({ id: '?', desc: 'failed', elapsed: 0, files: 0, success: false });
            }
          }
        }
      } else {
        console.log('\n' + section('Phase 2: Codex'));
        for (const task of codexTasks) {
          const start = Date.now();
          const r = await executeSubtask(task, 'codex');
          const elapsed = Math.round((Date.now() - start) / 1000);
          results.push({ id: task.id, desc: task.description.slice(0, 40), elapsed, files: r.files, success: r.success });
        }
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
    const conservationMode = config.conservation?.codexFirstOnUncertain ?? false;
    const decision = routeTask(signals, config.tier, claudePct, codexPct, taskDescription, { conservationMode });

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
      await executeOnClaude(taskDescription, { stream: true });
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

async function executeSubtask(subtask: SubTask, target: RouteTarget): Promise<{ success: boolean; files: number }> {
  if (target === 'codex') {
    const { result, elapsed } = await executeOnCodex(subtask.description);

    if (result.finalResult.success) {
      const filesCount = result.finalResult.filesModified.length;

      // Auto-apply: merge worktree
      if (result.finalResult.worktreePath && result.finalResult.branchName) {
        await applyWorktreeChanges(
          result.finalResult.worktreePath,
          result.finalResult.branchName,
          `auto-merge subtask #${subtask.id}`
        );
      }
      return { success: true, files: filesCount };
    } else {
      if (result.escalatedToClaude) {
        console.log(chalk.yellow('    \u2192 Escalating to Claude...'));
        await executeOnClaude(subtask.description, { stream: true });
      }
      return { success: false, files: 0 };
    }
  } else {
    // Claude task
    console.log(`  ${chalk.blue('\u2713')} #${subtask.id}  ${subtask.description.slice(0, 50)}`);
    const claudeResult = await executeOnClaude(subtask.description, { stream: true });
    return { success: claudeResult.success, files: 0 };
  }
}

async function executeCodexGo(task: string): Promise<void> {
  const { result } = await executeOnCodex(task);

  if (result.finalResult.success) {
    if (result.finalResult.worktreePath && result.finalResult.branchName) {
      await applyWorktreeChanges(
        result.finalResult.worktreePath,
        result.finalResult.branchName,
        'auto-merge codex task'
      );
    }
  } else {
    if (result.escalatedToClaude) {
      console.log(chalk.yellow('\n  \u2192 Escalating to Claude...'));
      await executeOnClaude(task, { stream: true });
    }
  }
}
