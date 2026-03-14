#!/usr/bin/env node

import { Command } from 'commander';
import { runTask } from './run.js';
import { goTask } from './go.js';
import { showStatus } from './status.js';
import { interactiveSetup } from './setup.js';
import { startRepl } from './repl.js';

const program = new Command();

program
  .name('mux')
  .description('agent-mux — Route tasks between Claude Code and Codex CLI')
  .version('0.3.0');

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
    await runTask(task, options);
  });

program
  .command('go <task>')
  .description('Auto-decompose, route, and execute — the "just do it" command')
  .option('--verbose', 'Show detailed signal analysis')
  .action(async (task: string, options: Record<string, unknown>) => {
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
  .action(async (key?: string, _value?: string) => {
    const { loadConfig } = await import('../config/loader.js');
    const config = await loadConfig();
    if (!key) {
      console.log(JSON.stringify(config, null, 2));
    }
  });

program.parse();
