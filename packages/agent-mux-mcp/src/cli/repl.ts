import { createInterface } from 'node:readline';
import chalk from 'chalk';
import { runTask } from './run.js';
import { goTask } from './go.js';
import { showStatus } from './status.js';
import { loadConfig } from '../config/loader.js';
import { getBudgetStatus } from '../budget/tracker.js';
import { TIER_LIMITS } from '../config/tiers.js';
import { box, progressBar } from './ui.js';

export async function startRepl(): Promise<void> {
  // Set up readline and register handlers IMMEDIATELY to capture piped stdin.
  // Use terminal: false to prevent readline double-echo on macOS.
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // Queue lines and process sequentially; buffer lines until init completes
  const lineQueue: string[] = [];
  let processing = false;
  let inputClosed = false;
  let initialized = false;

  async function processLine(input: string): Promise<void> {
    try {
      if (input === '/quit' || input === '/exit' || input === '/q') {
        console.log(chalk.gray('\n  Bye!\n'));
        rl.close();
        process.exit(0);
      } else if (input === '/status') {
        await showStatus();
      } else if (input === '/config') {
        const cfg = await loadConfig();
        console.log(JSON.stringify(cfg, null, 2));
      } else if (input === '/help') {
        printHelp();
      } else if (input.startsWith('/go ')) {
        const task = input.slice(4).trim();
        if (task) {
          await goTask(task, {});
        }
      } else if (input.startsWith('/')) {
        console.log(
          chalk.yellow(`  Unknown command: ${input}. Type /help for available commands.`)
        );
      } else {
        // Regular task — route and execute
        await runTask(input, {});
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`  Error: ${message}`));
    }

    // Show updated budget after each task execution
    if (!input.startsWith('/')) {
      try {
        const updatedBudget = await getBudgetStatus();
        const cfg = await loadConfig();
        const lim = TIER_LIMITS[cfg.tier];
        printBudgetLine(updatedBudget, lim);
      } catch {
        // Budget display is best-effort
      }
    }
  }

  async function drainQueue(): Promise<void> {
    if (processing || !initialized) return;
    processing = true;

    while (lineQueue.length > 0) {
      const input = lineQueue.shift()!;
      if (!input) {
        process.stdout.write('mux> ');
        continue;
      }
      await processLine(input);
      console.log();
      process.stdout.write('mux> ');
    }

    processing = false;

    // If input stream closed while processing, exit now
    if (inputClosed) {
      process.exit(0);
    }
  }

  // Register event handlers IMMEDIATELY so piped input is captured
  rl.on('line', (line: string) => {
    lineQueue.push(line.trim());
    void drainQueue();
  });

  rl.on('close', () => {
    inputClosed = true;
    // If not processing and queue is empty, exit. Otherwise drainQueue will exit when done.
    if (!processing && lineQueue.length === 0) {
      process.exit(0);
    }
  });

  // Now do async initialization (config loading, header display)
  const config = await loadConfig();
  const budget = await getBudgetStatus();
  const limits = TIER_LIMITS[config.tier];

  // Header
  console.log();
  console.log(printHeader(config, budget, limits));
  console.log();
  console.log(chalk.gray('  Commands: /status  /go  /config  /help  /quit'));
  console.log();

  // Manual prompt to avoid readline double-echo on macOS
  process.stdout.write('mux> ');

  // Mark as initialized and drain any buffered lines
  initialized = true;
  void drainQueue();
}

function printHeader(
  config: { tier: string; claude: { cost: number }; codex: { cost: number } },
  budget: { claude: { usagePercent: number; tasksCompleted: number }; codex: { usagePercent: number; tasksCompleted: number } },
  limits: { claudeMsg5hr: number; codexTasksDay: number }
): string {
  const codexTotal = limits.codexTasksDay === Infinity ? '\u221e' : String(limits.codexTasksDay);

  const claudePct = Math.round(budget.claude.usagePercent);
  const codexPct = Math.round(budget.codex.usagePercent);

  const claudeBarStr = `${progressBar(claudePct)}  ${String(claudePct).padStart(3)}%  (${budget.claude.tasksCompleted}/${limits.claudeMsg5hr})`;
  const codexBarStr = `${progressBar(codexPct)}  ${String(codexPct).padStart(3)}%  (${budget.codex.tasksCompleted}/${codexTotal})`;

  const lines = [
    chalk.bold(`agent-mux v0.4.0`),
    `Tier: ${chalk.bold(config.tier)} ($${config.claude.cost + config.codex.cost}/mo)`,
    '',
    `Claude  ${claudeBarStr}`,
    `Codex   ${codexBarStr}`,
  ];

  return box('', lines);
}

function printBudgetLine(budget: { claude: { usagePercent: number; tasksCompleted: number }; codex: { usagePercent: number; tasksCompleted: number } }, limits: { claudeMsg5hr: number; codexTasksDay: number }): void {
  const codexTotal =
    limits.codexTasksDay === Infinity ? '\u221E' : String(limits.codexTasksDay);
  const claudePct = Math.round(budget.claude.usagePercent);
  const codexPct = Math.round(budget.codex.usagePercent);
  console.log(
    `  Claude ${progressBar(claudePct, 10)} ${budget.claude.tasksCompleted}/${limits.claudeMsg5hr}`,
    chalk.gray('\u2502'),
    `Codex ${progressBar(codexPct, 10)} ${budget.codex.tasksCompleted}/${codexTotal}`
  );
}

function printHelp(): void {
  const lines = [
    chalk.bold('Commands'),
    '',
    `${chalk.white('<task>')}           Route and execute a task`,
    `${chalk.white('/go <task>')}       Auto-execute mode`,
    `${chalk.white('/status')}          Show budget dashboard`,
    `${chalk.white('/config')}          Show current configuration`,
    `${chalk.white('/help')}            Show this help`,
    `${chalk.white('/quit')}            Exit REPL`,
    '',
    chalk.gray('Routing is automatic. Tasks are analyzed and'),
    chalk.gray('sent to Claude or Codex based on complexity.'),
  ];
  console.log('\n' + box('Help', lines));
}
