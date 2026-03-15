import chalk from 'chalk';

let debugEnabled = false;

export function enableDebug(): void {
  debugEnabled = true;
}

export function isDebugEnabled(): boolean {
  return debugEnabled;
}

export function debug(...args: unknown[]): void {
  if (debugEnabled) {
    console.error(chalk.gray('[debug]'), ...args);
  }
}
