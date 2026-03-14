/**
 * Tool: get_mux_status
 * Returns the full orchestration status including config, budget, and task history.
 */

import { getBudgetStatus } from '../budget/tracker.js';
import { loadConfig } from '../config/loader.js';
import type { GetMuxStatusToolInput, MuxStatus, TaskStatus } from '../types.js';

/** In-memory task history */
const taskHistory: TaskStatus[] = [];

/** Server start timestamp for uptime calculation */
const serverStartTime = Date.now();

/**
 * Record a task in the status history.
 */
export function recordTaskStatus(task: TaskStatus): void {
  taskHistory.push(task);
}

/**
 * Get the full orchestration status.
 *
 * @param input - Options for including history and limiting results
 * @returns Full mux orchestration status
 */
export async function getStatus(input: GetMuxStatusToolInput): Promise<MuxStatus> {
  const config = await loadConfig();
  const budget = await getBudgetStatus();
  const uptimeMs = Date.now() - serverStartTime;

  let tasks: TaskStatus[] = [];
  if (input.includeHistory) {
    const limit = input.limit ?? 50;
    tasks = taskHistory.slice(-limit);
  } else {
    // Only show active (queued/running) tasks by default
    tasks = taskHistory.filter(
      (t) => t.status === 'queued' || t.status === 'running'
    );
  }

  return {
    config: {
      tier: config.tier,
      bias: config.routing.bias,
    },
    budget,
    tasks,
    uptimeMs,
  };
}
