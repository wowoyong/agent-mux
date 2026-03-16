import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { runTask } from './run.js';
import { goTask } from './go.js';
import { showStatus } from './status.js';
import { loadConfig } from '../config/loader.js';
import { getBudgetStatus } from '../budget/tracker.js';
import { TIER_LIMITS } from '../config/tiers.js';
import { box, progressBar } from './ui.js';

function getVersion(): string {
  try {
    // __dirname is available in CJS output; go up from dist/src/cli/ to package root
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf-8'));
    return pkg.version;
  } catch { return 'unknown'; }
}

export async function startRepl(): Promise<void> {
  // Set up readline and register handlers IMMEDIATELY to capture piped stdin.
  // Use terminal: true when stdin is a TTY for arrow-key history support.
  // Use terminal: false when piped to avoid issues with non-interactive input.
  // Tab completion for slash commands
  function completer(line: string): [string[], string] {
    const commands = ['/status', '/go', '/config', '/help', '/quit', '/chat', '/history'];
    if (line.startsWith('/')) {
      const hits = commands.filter(c => c.startsWith(line));
      return [hits.length ? hits : commands, line];
    }
    return [[], line];
  }

  const isTTY = process.stdin.isTTY === true;
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: isTTY,
    prompt: chalk.cyan('mux') + chalk.gray('> '),
    historySize: 100,
    completer,
  });

  // SIGINT handler: cancel running task gracefully without exiting
  rl.on('SIGINT', () => {
    console.log(chalk.yellow('\n  Task cancelled.'));
    rl.prompt();
  });

  // Queue lines and process sequentially; buffer lines until init completes
  const lineQueue: string[] = [];
  let processing = false;
  let inputClosed = false;
  let initialized = false;
  let emptyCount = 0;

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
      } else if (input === '/history') {
        const { getRoutingHistory } = await import('../routing/history.js');
        const { box: historyBox } = await import('./ui.js');
        const history = await getRoutingHistory(10);
        if (history.length === 0) {
          console.log(chalk.gray('  No routing history yet.'));
        } else {
          const lines = history.map(h => {
            const target = h.decision.target === 'claude' ? chalk.blue('Claude') : chalk.green('Codex');
            const time = new Date(h.timestamp).toLocaleTimeString();
            const conf = Math.round(h.decision.confidence * 100);
            return `${chalk.gray(time)}  ${target}  ${conf}%  ${h.taskSummary.slice(0, 35)}`;
          });
          console.log('\n' + historyBox('History (last 10)', lines));
        }
      } else if (input === '/chat' || input.startsWith('/chat ')) {
        const chatMsg = input.startsWith('/chat ') ? input.slice(6).trim() : '';
        if (chatMsg) {
          console.log(chalk.gray('  (chat mode → Claude)\n'));
          const { spawnClaude } = await import('./claude-spawner.js');
          await spawnClaude(chatMsg, { stream: true });
        } else {
          console.log(chalk.gray('  Usage: /chat <message>'));
        }
      } else if (input === '/go') {
        console.log(chalk.gray('  Usage: /go <task description>'));
        console.log(chalk.gray('  Example: /go "add auth middleware and write tests"'));
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
        emptyCount++;
        if (emptyCount >= 3) {
          console.log(chalk.gray('  Type a task or /help for commands'));
          emptyCount = 0;
        }
        rl.prompt();
        continue;
      }
      emptyCount = 0;
      await processLine(input);
      console.log();
      rl.prompt();
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
  console.log(chalk.gray('  Commands: /status  /go  /chat  /history  /config  /help  /quit'));
  console.log();

  // Use rl.prompt() instead of manual write to work correctly with terminal: true
  rl.prompt();

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
    chalk.bold(`agent-mux v${getVersion()}`),
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
    `${chalk.white('/go <task>')}       Auto-decompose, route, and execute without confirmation`,
    `${chalk.white('/chat <msg>')}      General chat (skip routing)`,
    `${chalk.white('/history')}         Show recent routing decisions`,
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
