import chalk from 'chalk';

// ─── Box-drawing characters ──────────────────────────────────────────
const BOX = { tl: '\u256d', tr: '\u256e', bl: '\u2570', br: '\u256f', h: '\u2500', v: '\u2502' };
const LIGHT = { tl: '\u250c', tr: '\u2510', bl: '\u2514', br: '\u2518', h: '\u2500', v: '\u2502' };

/** Strip ANSI escape codes from a string */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Visible length of a string (ignoring ANSI codes) */
function visLen(str: string): number {
  return stripAnsi(str).length;
}

/** Pad a string to a target visible width */
function padVisible(str: string, target: number): string {
  const diff = target - visLen(str);
  return diff > 0 ? str + ' '.repeat(diff) : str;
}

/**
 * Draw a rounded box (╭╮╰╯) around content lines.
 * @param title  Optional title displayed in the top border
 * @param lines  Content lines (may contain ANSI)
 * @param width  Total outer width including borders
 */
export function box(title: string, lines: string[], width = 52): string {
  const inner = width - 4; // 2 for border chars + 2 for padding spaces

  // Top border
  const titleStr = title ? ` ${title} ` : '';
  const topFill = Math.max(0, width - 2 - titleStr.length - 1);
  let result = chalk.gray(`${BOX.tl}${BOX.h}${titleStr}${BOX.h.repeat(topFill)}${BOX.tr}`) + '\n';

  // Content lines
  for (const line of lines) {
    result += chalk.gray(BOX.v) + ' ' + padVisible(line, inner) + ' ' + chalk.gray(BOX.v) + '\n';
  }

  // Bottom border
  result += chalk.gray(`${BOX.bl}${BOX.h.repeat(width - 2)}${BOX.br}`);
  return result;
}

/**
 * Draw a light box (┌┐└┘) — used for inner/nested sections.
 */
export function lightBox(title: string, lines: string[], width = 44): string {
  const inner = width - 4;

  const titleStr = title ? ` ${title} ` : '';
  const topFill = Math.max(0, width - 2 - titleStr.length - 1);
  let result = chalk.gray(`${LIGHT.tl}${LIGHT.h}${titleStr}${LIGHT.h.repeat(topFill)}${LIGHT.tr}`) + '\n';

  for (const line of lines) {
    result += chalk.gray(LIGHT.v) + ' ' + padVisible(line, inner) + ' ' + chalk.gray(LIGHT.v) + '\n';
  }

  result += chalk.gray(`${LIGHT.bl}${LIGHT.h.repeat(width - 2)}${LIGHT.br}`);
  return result;
}

/**
 * Render a progress bar.
 * @param pct   Percentage (0-100)
 * @param width Number of bar characters
 */
export function progressBar(pct: number, width = 20): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  const color = clamped >= 90 ? chalk.red : clamped >= 75 ? chalk.yellow : chalk.green;
  return color('\u2588'.repeat(filled)) + chalk.gray('\u2591'.repeat(empty));
}

/**
 * Section divider with a title.
 */
export function section(title: string, width = 48): string {
  const line = '\u2500'.repeat(Math.max(0, width - title.length - 2));
  return chalk.bold(`  ${title} ${chalk.gray(line)}`);
}

/**
 * Key-value label with aligned columns.
 */
export function label(key: string, value: string, keyWidth = 10): string {
  return `  ${chalk.gray(key.padEnd(keyWidth))} ${value}`;
}

/**
 * Indent every line of a multi-line string by a given number of spaces.
 */
export function indent(text: string, spaces = 2): string {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map(l => pad + l).join('\n');
}
