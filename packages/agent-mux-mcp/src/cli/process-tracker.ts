/**
 * Process Tracker
 * Tracks active child processes for graceful shutdown.
 */

import type { ChildProcess } from 'node:child_process';

const activeProcesses: Set<ChildProcess> = new Set();

export function registerProcess(proc: ChildProcess): void {
  activeProcesses.add(proc);
}

export function unregisterProcess(proc: ChildProcess): void {
  activeProcesses.delete(proc);
}

export function getActiveProcesses(): Set<ChildProcess> {
  return activeProcesses;
}
