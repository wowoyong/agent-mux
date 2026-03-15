#!/usr/bin/env node

import { Command } from 'commander';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { runTask } from './run.js';
import { goTask } from './go.js';
import { showStatus } from './status.js';
import { interactiveSetup } from './setup.js';
import { startRepl } from './repl.js';
import { cleanupStaleWorktrees } from '../codex/worktree.js';
import { getActiveProcesses } from './process-tracker.js';

// Re-export for convenience
export { registerProcess, unregisterProcess } from './process-tracker.js';

// ─── Version from package.json ───────────────────────────────────────
function getVersion(): string {
  try {
    // Go up from dist/src/cli/ to package root
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf-8'));
    return pkg.version;
  } catch { return 'unknown'; }
}

// ─── Git repo check ──────────────────────────────────────────────────
function isGitRepo(): boolean {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'pipe' });
    return true;
  } catch { return false; }
}

// ─── Graceful shutdown ───────────────────────────────────────────────
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n  Shutting down (${signal})...`);
  for (const proc of getActiveProcesses()) {
    proc.kill('SIGTERM');
  }
  try { await cleanupStaleWorktrees(); } catch {}
  process.exit(0);
}

process.on('SIGINT', () => { void gracefulShutdown('SIGINT'); });
process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });
process.on('unhandledRejection', (err) => {
  console.error('\n  Unexpected error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('\n  Fatal error:', err.message);
  process.exit(1);
});

const program = new Command();

program
  .name('mux')
  .description('agent-mux — Route tasks between Claude Code and Codex CLI')
  .version(getVersion());

program
  .argument('[task]', 'Task description to route and execute')
  .option('--dry-run', 'Show routing decision without executing')
  .option('--verbose', 'Show detailed signal analysis')
  .option('--route <target>', 'Force route to claude or codex')
  .option('--auto-apply', 'Skip confirmation for Codex results')
  .option('--confirm', 'Always confirm before applying (default for Codex)')
  .action(async (task: string | undefined, options: Record<string, unknown>) => {
    if (!task) {
      await startRepl();
      return;
    }
    // Check git repo for codex-routed tasks (non-forced-claude)
    if (options.route !== 'claude' && !isGitRepo()) {
      const { analyzeTask, routeTask } = await import('../routing/classifier.js');
      const { loadConfig } = await import('../config/loader.js');
      const { getBudgetStatus } = await import('../budget/tracker.js');
      const config = await loadConfig();
      const budget = await getBudgetStatus();
      const signals = analyzeTask(task);
      const claudePct = budget.claude.usagePercent / 100;
      const codexPct = budget.codex.usagePercent / 100;
      const decision = routeTask(signals, config.tier, claudePct, codexPct, task);
      if (decision.target === 'codex') {
        console.error('\n  \u26a0 Not a git repository. Codex tasks require a git project.');
        console.error('    \u2022 cd into a git project directory');
        console.error('    \u2022 Or use: mux --route=claude "your task"\n');
        process.exit(1);
      }
    }
    await runTask(task, options);
  });

program
  .command('go <task>')
  .description('Auto-decompose, route, and execute — the "just do it" command')
  .option('--verbose', 'Show detailed signal analysis')
  .action(async (task: string, _options: Record<string, unknown>) => {
    if (!isGitRepo()) {
      console.error('\n  \u26a0 Not a git repository. Codex tasks require a git project.');
      console.error('    \u2022 cd into a git project directory');
      console.error('    \u2022 Or use: mux --route=claude "your task"\n');
      process.exit(1);
    }
    await goTask(task, _options);
  });

program
  .command('status')
  .description('Show budget and routing status')
  .action(showStatus);

program
  .command('setup')
  .description('Interactive tier configuration')
  .action(interactiveSetup);

program
  .command('config [key] [value]')
  .description('View or set configuration')
  .action(async (key?: string, _value?: string) => {
    const { loadConfig } = await import('../config/loader.js');
    const config = await loadConfig();
    if (!key) {
      console.log(JSON.stringify(config, null, 2));
    }
  });

program
  .command('init')
  .description('Initialize agent-mux config for current project')
  .action(async () => {
    const { promises: fs } = await import('node:fs');
    const { join } = await import('node:path');

    const configDir = join(process.cwd(), '.agent-mux');
    const configPath = join(configDir, 'config.yaml');
    const gitignorePath = join(process.cwd(), '.gitignore');

    // Check if already initialized
    try {
      await fs.access(configPath);
      console.log(chalk.yellow('  .agent-mux/config.yaml already exists.'));
      return;
    } catch {}

    // Create config
    await fs.mkdir(configDir, { recursive: true });
    const yaml = `schema_version: 1\ntier: standard\n\nclaude:\n  plan: max_5x\n  cost: 100\n\ncodex:\n  plan: plus\n  cost: 20\n  mode: local\n\nrouting:\n  engine: local\n  bias: balanced\n  split:\n    claude: 55\n    codex: 45\n  escalation:\n    enabled: true\n    strategy: fix\n    max_retries: 2\n\nbudget:\n  warnings: [75, 90]\n`;
    await fs.writeFile(configPath, yaml, 'utf-8');

    // Add .codex-worktrees/ to .gitignore
    try {
      let gitignore = '';
      try { gitignore = await fs.readFile(gitignorePath, 'utf-8'); } catch {}
      if (!gitignore.includes('.codex-worktrees')) {
        await fs.appendFile(gitignorePath, '\n# agent-mux\n.codex-worktrees/\n.agent-mux/\n');
      }
    } catch {}

    console.log(chalk.green('  Initialized agent-mux'));
    console.log(chalk.gray('    Config: .agent-mux/config.yaml'));
    console.log(chalk.gray('    Added .codex-worktrees/ to .gitignore'));
    console.log(chalk.gray('\n    Run: mux setup   to customize tier'));
  });

program
  .command('clean')
  .description('Clean up orphaned Codex worktrees')
  .action(async () => {
    const { cleanupStaleWorktrees } = await import('../codex/worktree.js');
    const cleaned = await cleanupStaleWorktrees();
    if (cleaned > 0) {
      console.log(chalk.green(`  Cleaned ${cleaned} orphaned worktree(s)`));
    } else {
      console.log(chalk.gray('  No orphaned worktrees found.'));
    }
  });

// Cleanup stale worktrees silently on startup (fire-and-forget)
cleanupStaleWorktrees().catch(() => {});

program.parse();
