import { createInterface } from 'node:readline';
import chalk from 'chalk';
import { runTask } from './run.js';
import { goTask } from './go.js';
import { showStatus } from './status.js';
import { loadConfig } from '../config/loader.js';
import { getBudgetStatus } from '../budget/tracker.js';
import { TIER_LIMITS } from '../config/tiers.js';

export async function startRepl(): Promise<void> {
  const config = await loadConfig();
  const budget = await getBudgetStatus();
  const limits = TIER_LIMITS[config.tier];

  // Header
  console.log(
    chalk.bold(
      `\n  ⚡ agent-mux v0.3.1 | ${config.tier} tier ($${config.claude.cost + config.codex.cost}/mo)`
    )
  );
  printBudgetLine(budget, limits);
  console.log();
  console.log(chalk.gray('  Type a task to route, or a command:'));
  console.log(chalk.gray('    /status  — budget dashboard'));
  console.log(chalk.gray('    /go      — auto-execute mode'));
  console.log(chalk.gray('    /config  — show configuration'));
  console.log(chalk.gray('    /help    — show help'));
  console.log(chalk.gray('    /quit    — exit'));
  console.log();

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'mux> ',
    historySize: 100,
    terminal: process.stdin.isTTY ?? false,
  });

  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

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

    console.log();
    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

function printBudgetLine(budget: { claude: { usagePercent: number; tasksCompleted: number }; codex: { usagePercent: number; tasksCompleted: number } }, limits: { claudeMsg5hr: number; codexTasksDay: number }): void {
  const claudeBar = makeBar(budget.claude.usagePercent, 10);
  const codexBar = makeBar(budget.codex.usagePercent, 10);
  const codexTotal =
    limits.codexTasksDay === Infinity ? '\u221E' : String(limits.codexTasksDay);
  console.log(
    chalk.gray('  Claude'),
    claudeBar,
    chalk.gray(`${budget.claude.tasksCompleted}/${limits.claudeMsg5hr}`),
    chalk.gray('|'),
    chalk.gray('Codex'),
    codexBar,
    chalk.gray(`${budget.codex.tasksCompleted}/${codexTotal}`)
  );
}

function makeBar(pct: number, width: number): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const color = pct >= 90 ? chalk.red : pct >= 75 ? chalk.yellow : chalk.green;
  return color('\u2588'.repeat(filled)) + chalk.gray('\u2591'.repeat(empty));
}

function printHelp(): void {
  console.log(chalk.bold('\n  agent-mux Commands:\n'));
  console.log('  <task>           Route and execute a task');
  console.log('  /go <task>       Auto-execute mode (skip confirmations)');
  console.log('  /status          Show budget dashboard');
  console.log('  /config          Show current configuration');
  console.log('  /help            Show this help');
  console.log('  /quit            Exit REPL');
  console.log();
  console.log(chalk.gray('  Routing is automatic. Tasks are analyzed and sent to'));
  console.log(chalk.gray('  Claude (complex/interactive) or Codex (simple/independent).'));
}
