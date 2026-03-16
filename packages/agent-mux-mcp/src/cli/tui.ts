/**
 * Interactive TUI Dashboard
 * Panel-based terminal UI using ANSI escape codes.
 * No external dependencies — uses only Node built-ins + chalk.
 */

import { createInterface } from 'node:readline';
import chalk from 'chalk';
import { getBudgetStatus } from '../budget/tracker.js';
import { loadConfig } from '../config/loader.js';
import { TIER_LIMITS } from '../config/tiers.js';
import { getRoutingHistory } from '../routing/history.js';
import { detectPlugins } from './plugins.js';
import { progressBar, stripAnsi } from './ui.js';

// ─── ANSI Helpers ────────────────────────────────────────────────────

const ESC = '\x1b';
const clearScreen = () => process.stdout.write(`${ESC}[2J${ESC}[H`);
const moveTo = (row: number, col: number) => process.stdout.write(`${ESC}[${row};${col}H`);
const hideCursor = () => process.stdout.write(`${ESC}[?25l`);
const showCursor = () => process.stdout.write(`${ESC}[?25h`);

// ─── Panel Rendering ─────────────────────────────────────────────────

function drawBox(row: number, col: number, width: number, height: number, title: string): void {
  const h = '\u2500';
  const v = '\u2502';

  // Top border with title
  const titleStr = title ? ` ${title} ` : '';
  const topFill = Math.max(0, width - 2 - titleStr.length);
  moveTo(row, col);
  process.stdout.write(chalk.gray(`\u256d${h}${chalk.white(titleStr)}${h.repeat(topFill)}\u256e`));

  // Side borders
  for (let r = 1; r < height - 1; r++) {
    moveTo(row + r, col);
    process.stdout.write(chalk.gray(v) + ' '.repeat(width - 2) + chalk.gray(v));
  }

  // Bottom border
  moveTo(row + height - 1, col);
  process.stdout.write(chalk.gray(`\u2570${h.repeat(width - 2)}\u256f`));
}

function writeAt(row: number, col: number, text: string): void {
  moveTo(row, col);
  process.stdout.write(text);
}

// ─── Dashboard Panels ────────────────────────────────────────────────

interface DashboardState {
  tab: 'budget' | 'history' | 'config';
}

async function renderDashboard(state: DashboardState): Promise<void> {
  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;

  clearScreen();

  // Header
  const config = await loadConfig();
  const budget = await getBudgetStatus();
  const limits = TIER_LIMITS[config.tier];
  const codexTotal = limits.codexTasksDay === Infinity ? '\u221e' : String(limits.codexTasksDay);

  moveTo(1, 1);
  process.stdout.write(
    chalk.bold.cyan(' agent-mux') +
    chalk.gray(` | ${config.tier} tier | $${config.claude.cost + config.codex.cost}/mo | `) +
    chalk.gray(`${config.routing.engine} engine`)
  );

  // Tab bar
  moveTo(2, 1);
  const tabs = [
    state.tab === 'budget' ? chalk.bgCyan.black(' Budget ') : chalk.gray(' Budget '),
    state.tab === 'history' ? chalk.bgCyan.black(' History ') : chalk.gray(' History '),
    state.tab === 'config' ? chalk.bgCyan.black(' Config ') : chalk.gray(' Config '),
  ];
  process.stdout.write(' ' + tabs.join(chalk.gray(' | ')));

  // Separator
  moveTo(3, 1);
  process.stdout.write(chalk.gray('\u2500'.repeat(Math.min(cols, 78))));

  if (state.tab === 'budget') {
    await renderBudgetPanel(4, config, budget, limits, codexTotal, cols);
  } else if (state.tab === 'history') {
    await renderHistoryPanel(4, cols);
  } else {
    await renderConfigPanel(4, config, cols);
  }

  // Footer
  moveTo(rows - 1, 1);
  process.stdout.write(chalk.gray(' [1] Budget  [2] History  [3] Config  [r] Refresh  [q] Quit'));
}

async function renderBudgetPanel(
  startRow: number,
  config: any,
  budget: any,
  limits: any,
  codexTotal: string,
  cols: number
): Promise<void> {
  const panelWidth = Math.min(cols - 2, 60);

  drawBox(startRow, 2, panelWidth, 8, 'Budget');

  const claudePct = Math.round(budget.claude.usagePercent);
  const codexPct = Math.round(budget.codex.usagePercent);

  writeAt(startRow + 1, 4, `Claude  ${progressBar(claudePct, 25)}  ${String(claudePct).padStart(3)}%  (${budget.claude.tasksCompleted}/${limits.claudeMsg5hr})`);
  writeAt(startRow + 2, 4, chalk.gray(`        Capacity: ${budget.claude.remainingCapacity} | Plan: ${config.claude.plan}`));
  writeAt(startRow + 3, 4, '');
  writeAt(startRow + 4, 4, `Codex   ${progressBar(codexPct, 25)}  ${String(codexPct).padStart(3)}%  (${budget.codex.tasksCompleted}/${codexTotal})`);
  writeAt(startRow + 5, 4, chalk.gray(`        Capacity: ${budget.codex.remainingCapacity} | Plan: ${config.codex.plan}`));

  // Routing panel
  drawBox(startRow + 9, 2, panelWidth, 5, 'Routing');
  writeAt(startRow + 10, 4, `Engine: ${chalk.white(config.routing.engine)}  |  Bias: ${chalk.white(config.routing.bias)}`);
  writeAt(startRow + 11, 4, `Split:  Claude ${config.routing.split.claude}% / Codex ${config.routing.split.codex}%`);
  writeAt(startRow + 12, 4, chalk.gray(`Escalation: ${config.routing.escalation.strategy} (max ${config.routing.escalation.maxRetries} retries)`));

  // Warnings
  if (budget.warnings && budget.warnings.length > 0) {
    drawBox(startRow + 15, 2, panelWidth, 2 + budget.warnings.length, 'Warnings');
    for (let i = 0; i < budget.warnings.length; i++) {
      const w = budget.warnings[i];
      const icon = w.level === 'critical' ? chalk.red('!!') : w.level === 'warn' ? chalk.yellow(' !') : chalk.gray(' i');
      writeAt(startRow + 16 + i, 4, `${icon} ${w.message}`);
    }
  }

  // Plugins
  const plugins = detectPlugins();
  const installed = plugins.filter(p => p.available);
  if (installed.length > 0) {
    const pRow = budget.warnings?.length > 0 ? startRow + 17 + budget.warnings.length : startRow + 15;
    drawBox(pRow, 2, panelWidth, 2 + installed.length, 'Plugins');
    for (let i = 0; i < installed.length; i++) {
      writeAt(pRow + 1 + i, 4, chalk.green('\u2713') + ` ${installed[i].name}`);
    }
  }
}

async function renderHistoryPanel(startRow: number, cols: number): Promise<void> {
  const panelWidth = Math.min(cols - 2, 76);
  const history = await getRoutingHistory(15);

  drawBox(startRow, 2, panelWidth, 2 + Math.max(history.length, 1), 'Recent Routing Decisions');

  if (history.length === 0) {
    writeAt(startRow + 1, 4, chalk.gray('No routing history yet.'));
    return;
  }

  for (let i = 0; i < history.length; i++) {
    const h = history[i];
    const target = h.decision.target === 'claude' ? chalk.blue('Claude') : chalk.green('Codex ');
    const time = new Date(h.timestamp).toLocaleTimeString();
    const conf = String(Math.round(h.decision.confidence * 100)).padStart(3);
    const task = h.taskSummary.slice(0, Math.max(panelWidth - 40, 20));
    writeAt(startRow + 1 + i, 4, `${chalk.gray(time)}  ${target}  ${conf}%  ${task}`);
  }
}

async function renderConfigPanel(startRow: number, config: any, cols: number): Promise<void> {
  const panelWidth = Math.min(cols - 2, 60);
  const json = JSON.stringify(config, null, 2);
  const lines = json.split('\n');

  drawBox(startRow, 2, panelWidth, 2 + Math.min(lines.length, 20), 'Configuration');

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].slice(0, panelWidth - 6);
    writeAt(startRow + 1 + i, 4, chalk.gray(line));
  }
  if (lines.length > 20) {
    writeAt(startRow + 21, 4, chalk.gray(`(${lines.length - 20} more lines...)`));
  }
}

// ─── Main TUI Loop ──────────────────────────────────────────────────

export async function startTui(): Promise<void> {
  if (!process.stdin.isTTY) {
    console.error('  TUI requires an interactive terminal.');
    process.exit(1);
  }

  const state: DashboardState = { tab: 'budget' };

  hideCursor();
  process.stdin.setRawMode(true);
  process.stdin.resume();

  await renderDashboard(state);

  // Auto-refresh every 30s
  const refreshTimer = setInterval(async () => {
    await renderDashboard(state);
  }, 30000);

  process.stdin.on('data', async (data: Buffer) => {
    const key = data.toString();

    if (key === 'q' || key === '\x03') {
      // q or Ctrl+C
      clearInterval(refreshTimer);
      showCursor();
      clearScreen();
      process.stdin.setRawMode(false);
      process.exit(0);
    } else if (key === '1') {
      state.tab = 'budget';
      await renderDashboard(state);
    } else if (key === '2') {
      state.tab = 'history';
      await renderDashboard(state);
    } else if (key === '3') {
      state.tab = 'config';
      await renderDashboard(state);
    } else if (key === 'r') {
      await renderDashboard(state);
    }
  });

  // Cleanup on exit
  process.on('SIGINT', () => {
    clearInterval(refreshTimer);
    showCursor();
    process.stdin.setRawMode(false);
    process.exit(0);
  });
}
