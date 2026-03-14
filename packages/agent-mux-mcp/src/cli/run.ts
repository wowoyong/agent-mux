import chalk from 'chalk';
import ora from 'ora';
import { analyzeTask, routeTask } from '../routing/classifier.js';
import { spawnWithRetry } from '../codex/retry.js';
import { loadConfig } from '../config/loader.js';
import { getBudgetStatus } from '../budget/tracker.js';
import { TIER_LIMITS } from '../config/tiers.js';
import { spawnClaude } from './claude-spawner.js';
import type { MuxConfig } from '../types.js';

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
          console.log(chalk.gray(`  -- ${f}`));
        }
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
  const spinner = ora({
    text: chalk.blue('Claude working...'),
    spinner: 'dots',
  }).start();

  try {
    const result = await spawnClaude(task);

    if (result.success) {
      spinner.succeed(chalk.blue('Claude completed'));
      console.log(chalk.gray('\n' + result.output));
    } else {
      spinner.fail(chalk.red('Claude failed'));
      console.error(chalk.red(result.error || 'Unknown error'));
    }
  } catch (err: unknown) {
    spinner.fail(chalk.red('Claude execution failed'));
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(message));
  }
}
