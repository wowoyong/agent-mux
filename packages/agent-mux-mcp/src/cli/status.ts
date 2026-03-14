import chalk from 'chalk';
import { getBudgetStatus } from '../budget/tracker.js';
import { loadConfig } from '../config/loader.js';
import { TIER_LIMITS } from '../config/tiers.js';
import { detectCodexCli } from '../config/detector.js';

export async function showStatus(): Promise<void> {
  const config = await loadConfig();
  const budget = await getBudgetStatus();
  const limits = TIER_LIMITS[config.tier];
  const codex = await detectCodexCli();

  console.log(chalk.bold('\n=== agent-mux Status ===\n'));

  // Tier info
  console.log(`  Tier: ${chalk.bold(config.tier)} ($${config.claude.cost + config.codex.cost}/mo)`);
  console.log(`  Codex CLI: ${codex.installed ? chalk.green(`[ok] ${codex.version}`) : chalk.red('[x] not installed')}`);
  console.log();

  // Budget bars
  const claudeBar = makeBar(budget.claude.usagePercent);
  const codexBar = makeBar(budget.codex.usagePercent);

  console.log(`  Claude:  ${claudeBar}  ${budget.claude.tasksCompleted}/${limits.claudeMsg5hr}`);
  console.log(`  Codex:   ${codexBar}  ${budget.codex.tasksCompleted}/${limits.codexTasksDay === Infinity ? 'inf' : limits.codexTasksDay}`);
  console.log();

  // Warnings
  if (budget.warnings && budget.warnings.length > 0) {
    for (const w of budget.warnings) {
      const icon = w.level === 'critical' ? '!!' : w.level === 'warn' ? '!' : 'i';
      console.log(`  [${icon}] ${w.message}`);
    }
    console.log();
  }

  // Routing config
  console.log(chalk.gray(`  Routing: ${config.routing.engine} | Bias: ${config.routing.bias} | Split: ${config.routing.split.claude}/${config.routing.split.codex}`));
  console.log();
}

function makeBar(pct: number): string {
  const width = 20;
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const color = pct >= 90 ? chalk.red : pct >= 75 ? chalk.yellow : chalk.green;
  return color('#'.repeat(filled)) + chalk.gray('-'.repeat(empty));
}
