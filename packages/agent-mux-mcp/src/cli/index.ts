#!/usr/bin/env node

import { Command } from 'commander';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { runTask } from './run.js';
import { goTask } from './go.js';
import { showStatus } from './status.js';
import { interactiveSetup } from './setup.js';
import { startRepl } from './repl.js';
import { cleanupStaleWorktrees } from '../codex/worktree.js';
import { getActiveProcesses } from './process-tracker.js';
import { enableDebug, debug } from './debug.js';
import { checkForUpdates } from './update-check.js';

// Re-export for convenience
export { registerProcess, unregisterProcess } from './process-tracker.js';

// ─── Version from package.json ───────────────────────────────────────
function getVersion(): string {
  try {
    // Go up from dist/src/cli/ to package root
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf-8'));
    return pkg.version;
  } catch (err) { debug('Failed to read package.json version:', err); return 'unknown'; }
}

// ─── Git repo check ──────────────────────────────────────────────────
function isGitRepo(): boolean {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'pipe' });
    return true;
  } catch (err) { debug('Git repo check failed:', err); return false; }
}

// ─── Graceful shutdown ───────────────────────────────────────────────
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n  Shutting down (${signal})...`);
  for (const proc of getActiveProcesses()) {
    proc.kill('SIGTERM');
  }
  try { await cleanupStaleWorktrees(); } catch (err) { debug('Cleanup during shutdown failed:', err); }
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
  .version(getVersion())
  .option('--debug', 'Show detailed routing signals and execution info')
  .option('--resume', 'Resume previous session');

program
  .argument('[task]', 'Task description to route and execute')
  .option('--dry-run', 'Show routing decision without executing')
  .option('--verbose', 'Show detailed signal analysis')
  .option('--route <target>', 'Force route to claude or codex')
  .option('--auto-apply', 'Skip confirmation for Codex results')
  .option('--confirm', 'Always confirm before applying (default for Codex)')
  .option('-f, --file <files...>', 'Files to include as context')
  .action(async (taskArg: string | undefined, options: Record<string, unknown>) => {
    // Enable debug mode if --debug flag is set (from global or local option)
    if (program.opts().debug) {
      enableDebug();
      debug('Debug mode enabled');
    }
    if (!taskArg) {
      await startRepl();
      return;
    }

    // Append file contexts if -f/--file specified
    let task = taskArg;
    if (options.file) {
      const files = options.file as string[];
      const contexts: string[] = [];
      for (const f of files) {
        try {
          const content = await fsPromises.readFile(f, 'utf-8');
          contexts.push(`\n--- File: ${f} ---\n${content}\n`);
          debug(`Loaded file context: ${f} (${content.length} chars)`);
        } catch (err) {
          debug(`Failed to read file context: ${f}`, err);
        }
      }
      task = task + contexts.join('');
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
      const conservationMode = config.conservation?.codexFirstOnUncertain ?? false;
      const decision = routeTask(signals, config.tier, claudePct, codexPct, task, { conservationMode });
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
  .action(async (task: string, options: Record<string, unknown>) => {
    if (!isGitRepo()) {
      console.error('\n  \u26a0 Not a git repository. Codex tasks require a git project.');
      console.error('    \u2022 cd into a git project directory');
      console.error('    \u2022 Or use: mux --route=claude "your task"\n');
      process.exit(1);
    }
    await goTask(task, options);
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
  .action(async (key?: string, value?: string) => {
    const { loadConfig, saveConfig } = await import('../config/loader.js');
    const config = await loadConfig();
    if (!key) {
      console.log(JSON.stringify(config, null, 2));
      return;
    }
    if (!value) {
      const val = key.split('.').reduce((o: any, k: string) => o?.[k], config as any);
      console.log(`${key} = ${JSON.stringify(val)}`);
      return;
    }
    // Set nested value
    const keys = key.split('.');
    const last = keys.pop()!;
    const target = keys.reduce((o: any, k: string) => (o[k] = o[k] ?? {}, o[k]), config as any);
    target[last] = value === 'true' ? true : value === 'false' ? false : !isNaN(Number(value)) ? Number(value) : value;
    await saveConfig(config);
    console.log(chalk.green(`  ✓ ${key} = ${value}`));
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
    } catch (err) { debug('Config not found (expected for init):', err); }

    // Create config
    await fs.mkdir(configDir, { recursive: true });
    const yaml = `schema_version: 1\ntier: standard\n\nclaude:\n  plan: max_5x\n  cost: 100\n\ncodex:\n  plan: plus\n  cost: 20\n  mode: local\n\nrouting:\n  engine: local\n  bias: balanced\n  split:\n    claude: 55\n    codex: 45\n  escalation:\n    enabled: true\n    strategy: fix\n    max_retries: 2\n\nbudget:\n  warnings: [75, 90]\n`;
    await fs.writeFile(configPath, yaml, 'utf-8');

    // Add .codex-worktrees/ to .gitignore
    try {
      let gitignore = '';
      try { gitignore = await fs.readFile(gitignorePath, 'utf-8'); } catch (err) { debug('No existing .gitignore:', err); }
      if (!gitignore.includes('.codex-worktrees')) {
        await fs.appendFile(gitignorePath, '\n# agent-mux\n.codex-worktrees/\n.agent-mux/\n');
      }
    } catch (err) { debug('Failed to update .gitignore:', err); }

    console.log(chalk.green('  Initialized agent-mux'));
    console.log(chalk.gray('    Config: .agent-mux/config.yaml'));
    console.log(chalk.gray('    Added .codex-worktrees/ to .gitignore'));
    console.log(chalk.gray('\n    Run: mux setup   to customize tier'));
  });

program
  .command('undo')
  .description('Undo the last Codex merge (git revert)')
  .action(async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const exec = promisify(execFile);

    try {
      // Find last merge commit with "mux:" prefix
      const { stdout: log } = await exec('git', ['log', '--oneline', '--merges', '-10']);
      const muxMerge = log.split('\n').find(line => line.includes('mux:'));

      if (!muxMerge) {
        console.log(chalk.yellow('  No recent mux merge commits found.'));
        return;
      }

      const commitHash = muxMerge.split(' ')[0];
      console.log(chalk.gray(`  Reverting: ${muxMerge.trim()}`));

      await exec('git', ['revert', commitHash, '--no-edit']);
      console.log(chalk.green('  ✓ Reverted successfully'));
    } catch (err: any) {
      console.log(chalk.red(`  Failed to revert: ${err.message}`));
    }
  });

program
  .command('export')
  .description('Export usage statistics')
  .option('--format <format>', 'Output format: json or csv', 'json')
  .option('--days <days>', 'Number of days to export', '7')
  .action(async (options) => {
    const { loadUsageRecords } = await import('../budget/persistence.js');
    const days = parseInt(options.days) || 7;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const records = await loadUsageRecords(since);

    if (options.format === 'csv') {
      console.log('timestamp,agent,taskId,success');
      for (const r of records) {
        console.log(`${new Date(r.timestamp).toISOString()},${r.agent},${r.taskId},${r.success}`);
      }
    } else {
      console.log(JSON.stringify(records, null, 2));
    }
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

program
  .command('watch <task>')
  .description('Re-run task on file changes (TDD workflow)')
  .option('-p, --pattern <glob>', 'File glob pattern to watch', 'src/**/*')
  .option('-d, --debounce <ms>', 'Debounce delay in ms', '1000')
  .action(async (task: string, options: { pattern: string; debounce: string }) => {
    const { watch } = await import('node:fs');
    const { resolve } = await import('node:path');
    const debounceMs = parseInt(options.debounce) || 1000;

    console.log(chalk.cyan(`\n  Watching: ${options.pattern}`));
    console.log(chalk.gray(`  Task: "${task}"`));
    console.log(chalk.gray(`  Debounce: ${debounceMs}ms`));
    console.log(chalk.gray('  Press Ctrl+C to stop\n'));

    // Initial run
    console.log(chalk.gray('  --- Initial run ---'));
    await runTask(task, {});

    // Watch for changes
    let timer: ReturnType<typeof setTimeout> | null = null;
    let running = false;

    const watchDir = resolve(options.pattern.split('*')[0] || '.');
    const watcher = watch(watchDir, { recursive: true }, (_event, filename) => {
      if (!filename || running) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        running = true;
        console.log(chalk.gray(`\n  --- Change detected: ${filename} ---`));
        try {
          await runTask(task, {});
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(chalk.red(`  Error: ${msg}`));
        }
        running = false;
      }, debounceMs);
    });

    // Keep alive
    process.on('SIGINT', () => {
      watcher.close();
      console.log(chalk.gray('\n  Watch stopped.'));
      process.exit(0);
    });

    // Prevent exit
    await new Promise(() => {});
  });

program
  .command('batch')
  .description('Queue multiple tasks and execute them sequentially')
  .option('--timeout <sec>', 'Max wait time for input in seconds', '30')
  .action(async (options: { timeout: string }) => {
    const { createInterface } = await import('node:readline');
    const timeoutSec = parseInt(options.timeout) || 30;

    console.log(chalk.cyan('\n  Batch mode'));
    console.log(chalk.gray(`  Enter tasks one per line. Empty line or ${timeoutSec}s timeout to start execution.\n`));

    const tasks: string[] = [];
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    // Collect tasks with timeout
    await new Promise<void>((resolve) => {
      let timer = setTimeout(resolve, timeoutSec * 1000);

      rl.on('line', (line: string) => {
        clearTimeout(timer);
        const trimmed = line.trim();
        if (!trimmed) {
          rl.close();
          resolve();
          return;
        }
        tasks.push(trimmed);
        console.log(chalk.gray(`  [${tasks.length}] ${trimmed}`));
        timer = setTimeout(resolve, timeoutSec * 1000);
      });

      rl.on('close', () => resolve());
    });

    if (tasks.length === 0) {
      console.log(chalk.yellow('  No tasks queued.'));
      return;
    }

    console.log(chalk.cyan(`\n  Executing ${tasks.length} task(s)...\n`));

    let completed = 0;
    let failed = 0;
    for (const task of tasks) {
      console.log(chalk.white(`  [${completed + failed + 1}/${tasks.length}] ${task.slice(0, 50)}`));
      try {
        await runTask(task, {});
        completed++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`  Error: ${msg}`));
        failed++;
      }
    }

    console.log(chalk.cyan(`\n  Batch complete: ${completed} succeeded, ${failed} failed.\n`));
  });

// Cleanup stale worktrees silently on startup (fire-and-forget)
cleanupStaleWorktrees().catch(err => debug('Silent error cleaning stale worktrees:', err));

// Check for updates silently on startup (fire-and-forget, non-blocking)
checkForUpdates(getVersion()).catch(err => debug('Silent error checking for updates:', err));

program.parse();
