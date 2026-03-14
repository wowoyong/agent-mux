import chalk from 'chalk';
import { createInterface } from 'node:readline';
import { getDefaultConfig } from '../config/loader.js';
import { saveConfig } from '../config/loader.js';
import { detectCodexCli } from '../config/detector.js';
import type { TierName } from '../types.js';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r));

export async function interactiveSetup(): Promise<void> {
  console.log(chalk.bold('\n=== agent-mux Setup ===\n'));

  // Check Codex
  const codex = await detectCodexCli();
  console.log(`  Codex CLI: ${codex.installed ? chalk.green(`[ok] ${codex.version}`) : chalk.red('[x] not installed')}`);

  if (!codex.installed) {
    console.log(chalk.yellow('\n  [!] Install Codex CLI first: npm install -g @openai/codex\n'));
    rl.close();
    return;
  }

  // Claude plan
  console.log(chalk.bold('\n  Claude plan:'));
  console.log('    1) Pro ($20/mo)      -- ~45 messages/5hr');
  console.log('    2) Max 5x ($100/mo)  -- ~225 messages/5hr');
  console.log('    3) Max 20x ($200/mo) -- ~900 messages/5hr');
  const claudeChoice = await ask('\n  Select (1-3): ');

  // Codex plan
  console.log(chalk.bold('\n  Codex plan:'));
  console.log('    1) Plus ($20/mo)  -- 1 concurrent task');
  console.log('    2) Pro ($200/mo)  -- 3 concurrent tasks');
  const codexChoice = await ask('\n  Select (1-2): ');

  // Determine tier
  const tier = determineTier(claudeChoice.trim(), codexChoice.trim());
  const config = getDefaultConfig(tier);

  console.log(chalk.bold(`\n  Tier: ${chalk.green(tier)} ($${config.claude.cost + config.codex.cost}/mo)`));
  console.log(chalk.gray(`    Routing: ${config.routing.engine} | ${config.routing.split.claude}% Claude / ${config.routing.split.codex}% Codex`));

  // Save config
  await saveConfig(config);

  console.log(chalk.green(`\n  Config saved to .agent-mux/config.yaml`));
  console.log(chalk.gray('\n  Usage:'));
  console.log(chalk.gray('    mux "task description"   -- route a task'));
  console.log(chalk.gray('    mux status               -- check budget'));
  console.log(chalk.gray('    mux --dry-run "..."       -- preview routing\n'));

  rl.close();
}

function determineTier(claude: string, codex: string): TierName {
  if (claude === '1' && codex === '1') return 'budget';
  if (claude === '2' && codex === '1') return 'standard';
  if (claude === '3' && codex === '1') return 'premium';
  if (claude === '3' && codex === '2') return 'power';
  return 'standard'; // default
}
