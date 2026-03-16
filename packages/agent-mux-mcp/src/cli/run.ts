import { createInterface } from 'node:readline';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import chalk from 'chalk';
import { analyzeTask, routeTask, routeTaskHybrid, isCodingTask } from '../routing/classifier.js';
import { loadConfig } from '../config/loader.js';
import { getBudgetStatus } from '../budget/tracker.js';
import { TIER_LIMITS } from '../config/tiers.js';
import { spawnClaude } from './claude-spawner.js';
import { executeOnCodex, executeOnClaude, applyWorktreeChanges, rollbackWorktree } from './executor.js';
import { lightBox, progressBar, indent, getTerminalWidth } from './ui.js';
import { estimateCost } from '../budget/estimator.js';
import { debug } from './debug.js';

const execAsync = promisify(execFile);

interface RunOptions {
  dryRun?: boolean;
  verbose?: boolean;
  route?: string;
  autoApply?: boolean;
  confirm?: boolean;
}

export async function runTask(taskDescription: string, options: RunOptions): Promise<void> {
  // If not a coding task, handle as general chat
  if (!isCodingTask(taskDescription)) {
    console.log(chalk.gray('  (general chat \u2192 Claude)\n'));
    await spawnClaude(taskDescription, { stream: true, model: 'haiku' });
    return;
  }

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
    const conservationMode = config.conservation?.codexFirstOnUncertain ?? false;
    if (config.routing.engine === 'hybrid') {
      decision = await routeTaskHybrid(taskDescription, config.tier, claudePct, codexPct, { conservationMode });
    } else {
      decision = routeTask(signals, config.tier, claudePct, codexPct, taskDescription, { conservationMode });
    }
  }

  const confPct = Math.round(decision.confidence * 100);
  const targetName = decision.target === 'claude' ? 'Claude' : 'Codex';
  const targetColor = decision.target === 'claude' ? chalk.blue : chalk.green;

  // Display routing decision
  if (options.verbose) {
    // Verbose: full box
    const routeLines = [
      `Target:     ${targetColor.bold(targetName)}`,
      `Reason:     ${decision.reason}`,
      `Confidence: ${progressBar(confPct)} ${confPct}%`,
    ];

    // Add signals
    const activeSignals = Object.entries(signals)
      .filter(([, v]) => typeof v === 'boolean' && v)
      .map(([k]) => k);

    if (activeSignals.length > 0) {
      routeLines.push('');
      routeLines.push(chalk.gray('Signals: ' + activeSignals.join(', ')));
    }

    // Cost estimate
    const cost = estimateCost(signals, decision.target);
    routeLines.push('');
    routeLines.push(chalk.gray(`Est. cost: ${(cost.relativeCost * 100).toFixed(1)}% of budget (${cost.factors.join(', ') || 'base'})`));

    console.log('\n' + indent(lightBox('Routing', routeLines)));
  } else {
    // Compact styled routing line
    console.log(
      `\n  ${chalk.gray('\u2192')} ${targetColor.bold(targetName)}  ${chalk.gray(decision.reason)}  ${progressBar(confPct, 10)} ${chalk.gray(confPct + '%')}`
    );
  }

  // Dry run: stop here
  if (options.dryRun) {
    console.log(chalk.yellow('\n  [DRY RUN] No execution performed.'));
    return;
  }

  // Execute based on routing
  if (decision.target === 'codex') {
    await executeCodex(taskDescription, options);
  } else {
    // Choose model based on complexity: use sonnet for non-high complexity tasks
    const model = signals.estimatedComplexity === 'high' ? undefined : 'sonnet';
    await executeOnClaude(taskDescription, { stream: true, model });
  }

  // Show budget after execution
  const updatedBudget = await getBudgetStatus();
  const limits = TIER_LIMITS[config.tier];
  const codexTotal = limits.codexTasksDay === Infinity ? '\u221e' : String(limits.codexTasksDay);
  console.log(
    chalk.gray('\n  Budget:'),
    chalk.blue(`Claude ${updatedBudget.claude.tasksCompleted}/${limits.claudeMsg5hr}`),
    chalk.gray('\u2502'),
    chalk.green(`Codex ${updatedBudget.codex.tasksCompleted}/${codexTotal}`)
  );
}

async function executeCodex(task: string, options: RunOptions): Promise<void> {
  try {
    const { result } = await executeOnCodex(task);

    if (result.finalResult.success) {
      // Show modified files
      if (result.finalResult.filesModified.length > 0) {
        console.log(chalk.gray('\n  Modified files:'));
        for (const f of result.finalResult.filesModified) {
          console.log(chalk.gray(`    \u251c\u2500\u2500 ${f}`));
        }
      }

      // Show diff preview
      if (result.finalResult.worktreePath && result.finalResult.filesModified.length > 0) {
        const diff = await getDiff(result.finalResult.worktreePath);
        const termWidth = getTerminalWidth();
        const diffLines = diff.split('\n').map(l => l.length > termWidth - 8 ? l.slice(0, termWidth - 11) + '...' : l);
        const previewLines = diffLines.slice(0, 50);

        // Parse file info from diff for the header
        const fileInfo = parseDiffFileInfo(diff);
        const headerSuffix = fileInfo ? `  ${chalk.gray(fileInfo)}` : '';

        const coloredPreview = previewLines.map(line => colorDiffLine(line));
        if (diffLines.length > 50) {
          coloredPreview.push(chalk.gray(`(${diffLines.length - 50} more lines)`));
        }

        console.log('\n' + indent(lightBox('Diff Preview' + headerSuffix, coloredPreview)));

        // Confirmation prompt (unless --auto-apply)
        if (!options.autoApply) {
          const answer = await askUser('\n  Apply changes? [Y]es / [N]o / [D]iff full ');
          if (answer.toLowerCase() === 'd') {
            const allColored = diff.split('\n').map(line => colorDiffLine(line));
            console.log('\n' + indent(lightBox('Full Diff', allColored)));
            const answer2 = await askUser('\n  Apply changes? [Y]es / [N]o ');
            if (answer2.toLowerCase() !== 'y') {
              await rollbackWorktree(result.finalResult.worktreePath, result.finalResult.branchName);
              console.log(chalk.yellow('  Changes discarded.'));
              return;
            }
          } else if (answer.toLowerCase() !== 'y') {
            await rollbackWorktree(result.finalResult.worktreePath, result.finalResult.branchName);
            console.log(chalk.yellow('  Changes discarded.'));
            return;
          }
        }

        // Merge worktree
        await applyWorktreeChanges(
          result.finalResult.worktreePath,
          result.finalResult.branchName,
          'merge codex task'
        );
        console.log(chalk.green('  \u2713 Changes applied.'));
      }

      // Show retry info if any
      if (result.retryCount > 0) {
        console.log(chalk.yellow(`  (${result.retryCount} retry(s) needed)`));
      }
    } else {
      if (result.escalatedToClaude) {
        console.log(chalk.yellow('\n  \u2192 Escalating to Claude...'));
        await executeOnClaude(
          `Previous Codex attempt failed: ${result.escalationReason}\n\nOriginal task: ${task}`,
          { stream: true }
        );
      } else {
        console.log(chalk.red(`  Error: ${result.finalResult.stderr.slice(0, 200)}`));
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`  Codex execution failed: ${message}`));
  }
}

// ─── Diff Utilities ──────────────────────────────────────────────────

/** Colorize a single diff line */
function colorDiffLine(line: string): string {
  if (line.startsWith('+') && !line.startsWith('+++')) return chalk.green(line);
  if (line.startsWith('-') && !line.startsWith('---')) return chalk.red(line);
  if (line.startsWith('@@')) return chalk.cyan(line);
  return chalk.gray(line);
}

/** Parse file info from a unified diff header */
function parseDiffFileInfo(diff: string): string {
  const files = new Set<string>();
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) {
      files.add(line.slice(6));
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      additions++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions++;
    }
  }
  if (files.size === 0) return '';
  const fileList = files.size === 1
    ? [...files][0]
    : `${files.size} files`;
  return `${fileList}  (+${additions}, -${deletions})`;
}

/** Get unified diff from a worktree */
async function getDiff(worktreePath: string): Promise<string> {
  try {
    const { stdout } = await execAsync('git', ['diff', 'HEAD'], { cwd: worktreePath });
    return stdout;
  } catch (err) {
    debug('getDiff failed:', err);
    return '(unable to generate diff)';
  }
}

/** Ask user a question via stdin/stdout (creates a temporary readline and closes it after) */
function askUser(question: string): Promise<string> {
  return new Promise(r => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      r(answer);
    });
  });
}
