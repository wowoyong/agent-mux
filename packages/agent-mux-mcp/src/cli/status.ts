import chalk from 'chalk';
import { getBudgetStatus } from '../budget/tracker.js';
import { loadConfig } from '../config/loader.js';
import { TIER_LIMITS } from '../config/tiers.js';
import { detectCodexCli } from '../config/detector.js';
import { box, lightBox, progressBar, label, indent } from './ui.js';
import { detectPlugins, formatPluginStatus } from './plugins.js';

export async function showStatus(): Promise<void> {
  const config = await loadConfig();
  const budget = await getBudgetStatus();
  const limits = TIER_LIMITS[config.tier];
  const codex = await detectCodexCli();

  const codexTotal = limits.codexTasksDay === Infinity ? '\u221e' : String(limits.codexTasksDay);
  const claudePct = Math.round(budget.claude.usagePercent);
  const codexPct = Math.round(budget.codex.usagePercent);

  // Codex status
  const codexStatus = codex.installed
    ? chalk.green('\u2713') + ` ${codex.version}`
    : chalk.red('\u2717') + ' not installed';

  // Budget inner box
  const budgetLines = [
    `Claude  ${progressBar(claudePct)}  ${String(claudePct).padStart(3)}%`,
    chalk.gray(`        ${budget.claude.tasksCompleted} / ${limits.claudeMsg5hr} messages (5hr)`),
    `Codex   ${progressBar(codexPct)}  ${String(codexPct).padStart(3)}%`,
    chalk.gray(`        ${budget.codex.tasksCompleted} / ${codexTotal} tasks (daily)`),
  ];
  const budgetBox = lightBox('Budget', budgetLines);

  // Outer box lines
  const outerLines = [
    '',
    label('Tier', `${chalk.bold(config.tier)} ($${config.claude.cost + config.codex.cost}/mo)`),
    label('Codex', codexStatus),
    label('Engine', `${config.routing.engine} | Bias: ${config.routing.bias} | Split: ${config.routing.split.claude}/${config.routing.split.codex}`),
    '',
    // Embed budget box — indent each line
    ...budgetBox.split('\n').map(l => '  ' + l),
    '',
  ];

  // Plugins
  const plugins = detectPlugins();
  const installedPlugins = plugins.filter(p => p.available);
  if (installedPlugins.length > 0) {
    outerLines.push(chalk.gray('  Plugins:'));
    outerLines.push(...formatPluginStatus(plugins));
    outerLines.push('');
  }

  // Warnings
  if (budget.warnings && budget.warnings.length > 0) {
    for (const w of budget.warnings) {
      const icon = w.level === 'critical' ? chalk.red('!!') : w.level === 'warn' ? chalk.yellow('!') : chalk.gray('i');
      outerLines.push(`  ${icon} ${w.message}`);
    }
    outerLines.push('');
  }

  console.log('\n' + box('agent-mux Status', outerLines, 56) + '\n');
}
