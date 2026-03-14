/**
 * Budget Tracker
 * Tracks usage and remaining budget for Claude and Codex subscriptions.
 * Simple in-memory tracker that estimates remaining capacity based on
 * session usage and tier limits.
 */

import type { BudgetStatus, AgentBudget, RouteTarget, TierName } from '../types.js';
import { loadConfig } from '../config/loader.js';
import { TIER_LIMITS } from '../config/tiers.js';
import { estimateRemainingBudget } from './estimator.js';

// ─── In-Memory Session Usage ────────────────────────────────────────

interface SessionUsage {
  claudeMessages: number;
  codexTasks: number;
  sessionStart: number;
  windowStart: number; // 5hr window start
}

const usage: SessionUsage = {
  claudeMessages: 0,
  codexTasks: 0,
  sessionStart: Date.now(),
  windowStart: Date.now(),
};

/**
 * Record a Claude message against the budget.
 */
export function recordClaudeMessage(): void {
  usage.claudeMessages++;
}

/**
 * Record a Codex task against the budget.
 */
export function recordCodexTask(): void {
  usage.codexTasks++;
}

/**
 * Map usage percentage to a capacity label.
 */
function capacityFromPct(pct: number): 'high' | 'medium' | 'low' | 'exhausted' {
  if (pct >= 0.6) return 'high';
  if (pct >= 0.3) return 'medium';
  if (pct > 0) return 'low';
  return 'exhausted';
}

/**
 * Get the current budget status for all agents.
 *
 * @returns Combined budget status
 */
export async function getBudgetStatus(): Promise<BudgetStatus> {
  const config = await loadConfig();
  const tier: TierName = config.tier;
  const limits = TIER_LIMITS[tier];

  const claudeEstimate = estimateRemainingBudget(tier, usage.claudeMessages, usage.windowStart);
  const codexRemaining = Math.max(0, limits.codexTasksDay - usage.codexTasks);
  const codexPct = limits.codexTasksDay === Infinity ? 1.0 : (limits.codexTasksDay > 0 ? codexRemaining / limits.codexTasksDay : 0);

  const claudeBudget: AgentBudget = {
    agent: 'claude',
    monthlyCost: config.claude.cost,
    usagePercent: Math.round((1 - claudeEstimate.pct) * 100),
    tasksCompleted: usage.claudeMessages,
    remainingCapacity: capacityFromPct(claudeEstimate.pct),
  };

  const codexBudget: AgentBudget = {
    agent: 'codex',
    monthlyCost: config.codex.cost,
    usagePercent: Math.round((1 - codexPct) * 100),
    tasksCompleted: usage.codexTasks,
    remainingCapacity: capacityFromPct(codexPct),
  };

  // Determine active warnings
  const claudeUsedPct = (1 - claudeEstimate.pct) * 100;
  const activeWarnings = config.budget.warnings.filter(
    (threshold) => claudeUsedPct >= threshold
  );

  // Period dates (5-hour window)
  const periodStart = new Date(usage.windowStart).toISOString();
  const periodEnd = new Date(usage.windowStart + 5 * 60 * 60 * 1000).toISOString();

  return {
    claude: claudeBudget,
    codex: codexBudget,
    currentBias: config.routing.bias,
    activeWarnings,
    periodStart,
    periodEnd,
  };
}

/**
 * Get the budget status for a specific agent.
 *
 * @param agent - The agent to check
 * @returns Budget status for the specified agent
 */
export async function getAgentBudget(agent: RouteTarget): Promise<AgentBudget> {
  const status = await getBudgetStatus();
  return agent === 'claude' ? status.claude : status.codex;
}

/**
 * Record a task completion against the budget.
 *
 * @param agent - The agent that completed the task
 * @param _taskId - The task identifier (reserved for future use)
 */
export async function recordTask(agent: RouteTarget, _taskId: string): Promise<void> {
  if (agent === 'claude') {
    recordClaudeMessage();
  } else {
    recordCodexTask();
  }
}
