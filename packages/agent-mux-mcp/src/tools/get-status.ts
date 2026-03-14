/**
 * Tool: get_mux_status
 * Returns the full orchestration status including config, budget, and task history.
 */

import { getBudgetStatus, getWarnings } from '../budget/tracker.js';
import { loadConfig } from '../config/loader.js';
import { detectCodexCli, detectSiblingPlugins } from '../config/detector.js';
import { getRoutingStats } from '../routing/history.js';
import type { GetMuxStatusToolInput, MuxStatus, TaskStatus } from '../types.js';

/** In-memory task history */
const taskHistory: TaskStatus[] = [];

/** Completed task history for session statistics */
const completedTaskHistory: Array<{ target: string; success: boolean; timestamp: number }> = [];

/** Server start timestamp for uptime calculation */
const SESSION_START = Date.now();

/**
 * Record a task in the status history.
 */
export function recordTaskStatus(task: TaskStatus): void {
  taskHistory.push(task);
}

/**
 * Record a completed task for session statistics.
 */
export function recordCompletedTask(target: string, success: boolean): void {
  completedTaskHistory.push({ target, success, timestamp: Date.now() });
}

/**
 * Format a duration in milliseconds to a human-readable string.
 */
function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** Session statistics shape */
export interface SessionStats {
  totalTasks: number;
  claudeTasks: number;
  codexTasks: number;
  codexSuccessRate: number;
  sessionDuration: string;
}

/** Routing statistics from persistent history */
export interface RoutingStatsInfo {
  total: number;
  claudeCount: number;
  codexCount: number;
  overrideCount: number;
  successRate: number;
}

/** Extended status response with session stats and plugins */
export type MuxStatusExtended = MuxStatus & {
  sessionStats: SessionStats;
  routingStats: RoutingStatsInfo;
  detectedPlugins: string[];
  warnings: Array<{ level: string; message: string }>;
  codexCli: { available: boolean; version?: string };
};

/**
 * Get the full orchestration status.
 *
 * @param input - Options for including history and limiting results
 * @returns Full mux orchestration status with session stats
 */
export async function getStatus(input: GetMuxStatusToolInput): Promise<MuxStatusExtended> {
  const config = await loadConfig();
  const budget = await getBudgetStatus();
  const codexInfo = await detectCodexCli();
  const plugins = await detectSiblingPlugins();
  const budgetWarnings = await getWarnings();
  const uptimeMs = Date.now() - SESSION_START;

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

  const routingStats = await getRoutingStats();

  const claudeTasks = completedTaskHistory.filter(t => t.target === 'claude');
  const codexTasks = completedTaskHistory.filter(t => t.target === 'codex');
  const codexSuccess = codexTasks.filter(t => t.success);

  return {
    config: {
      tier: config.tier,
      bias: config.routing.bias,
    },
    budget,
    tasks,
    uptimeMs,
    sessionStats: {
      totalTasks: completedTaskHistory.length,
      claudeTasks: claudeTasks.length,
      codexTasks: codexTasks.length,
      codexSuccessRate: codexTasks.length > 0
        ? Math.round(codexSuccess.length / codexTasks.length * 100)
        : 100,
      sessionDuration: formatDuration(uptimeMs),
    },
    routingStats,
    detectedPlugins: plugins.map(p => p.name),
    warnings: budgetWarnings.map(w => ({ level: w.level, message: w.message })),
    codexCli: {
      available: codexInfo.installed,
      version: codexInfo.version ?? undefined,
    },
  };
}
