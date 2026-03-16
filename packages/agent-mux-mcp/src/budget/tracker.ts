/**
 * Budget Tracker
 * Tracks usage and remaining budget for Claude and Codex subscriptions.
 * Persistence-backed tracking with in-memory session counters for fast path.
 */

import type { BudgetStatus, AgentBudget, BudgetWarning, RouteTarget } from '../types.js';
import { loadConfig } from '../config/loader.js';
import { TIER_LIMITS } from '../config/tiers.js';
import { appendUsageRecord, getUsageSummary } from './persistence.js';

// ─── In-Memory Session Counters (fast path) ─────────────────────────

let sessionClaudeMessages = 0;
let sessionCodexTasks = 0;
const sessionStart = Date.now();

/**
 * Record a Claude message against the budget.
 * Persists to JSONL file (fire-and-forget).
 */
export async function recordClaudeMessage(taskId?: string): Promise<void> {
  sessionClaudeMessages++;
  await appendUsageRecord({
    timestamp: Date.now(),
    agent: 'claude',
    taskId: taskId ?? `claude-${sessionClaudeMessages}`,
    success: true,
  });
}

/**
 * Record a Codex task against the budget.
 * Persists to JSONL file (fire-and-forget).
 */
export async function recordCodexTask(taskId?: string, success: boolean = true): Promise<void> {
  sessionCodexTasks++;
  await appendUsageRecord({
    timestamp: Date.now(),
    agent: 'codex',
    taskId: taskId ?? `codex-${sessionCodexTasks}`,
    success,
  });
}

/**
 * Map usage percentage to a capacity label.
 */
function pctToCapacity(pct: number): 'high' | 'medium' | 'low' | 'exhausted' {
  if (pct >= 95) return 'exhausted';
  if (pct >= 75) return 'low';
  if (pct >= 50) return 'medium';
  return 'high';
}

/**
 * Generate budget warnings based on usage thresholds.
 */
function generateWarnings(thresholds: number[], claudePct: number, codexPct: number): BudgetWarning[] {
  const warnings: BudgetWarning[] = [];

  for (const threshold of thresholds) {
    if (claudePct >= threshold) {
      warnings.push({
        level: threshold >= 90 ? 'critical' : threshold >= 75 ? 'warn' : 'info',
        threshold,
        agent: 'claude',
        message: `Claude ${Math.round(claudePct)}% used — ${threshold >= 90 ? 'recommend Codex-only mode' : threshold >= 75 ? 'recommend Codex-first routing' : 'monitoring pace'}`,
        usagePct: claudePct,
      });
    }
    if (codexPct >= threshold) {
      warnings.push({
        level: threshold >= 90 ? 'critical' : threshold >= 75 ? 'warn' : 'info',
        threshold,
        agent: 'codex',
        message: `Codex ${Math.round(codexPct)}% used`,
        usagePct: codexPct,
      });
    }
  }

  return warnings;
}

/**
 * Get the current budget status for all agents, including warnings.
 *
 * @returns Combined budget status with warnings
 */
export async function getBudgetStatus(): Promise<BudgetStatus & { warnings: BudgetWarning[] }> {
  const config = await loadConfig();
  const tier = config.tier;
  const limits = TIER_LIMITS[tier];

  // Get usage from the current 5hr window (disk) as source of truth.
  // Disk records are authoritative; session counters are only used as a floor
  // for the current session (in case append hasn't flushed yet for very recent writes).
  // This avoids double-counting across concurrent sessions.
  const fiveHoursMs = 5 * 60 * 60 * 1000;
  const windowUsage = await getUsageSummary(fiveHoursMs);
  // Disk is source of truth. Only fall back to session counter if disk shows less
  // than our current session's count (i.e., writes haven't flushed yet).
  const claudeUsed = Math.max(windowUsage.claude, sessionClaudeMessages);
  const codexUsed = Math.max(windowUsage.codex, sessionCodexTasks);

  // Calculate percentages
  const claudePct = limits.claudeMsg5hr > 0 ? (claudeUsed / limits.claudeMsg5hr) * 100 : 0;
  const codexPct = limits.codexTasksDay < Infinity ? (codexUsed / limits.codexTasksDay) * 100 : 0;

  // Generate warnings
  const warnings = generateWarnings(config.budget.warnings, claudePct, codexPct);

  // Build response
  const claude: AgentBudget = {
    agent: 'claude',
    monthlyCost: config.claude.cost,
    usagePercent: Math.round(claudePct),
    tasksCompleted: claudeUsed,
    remainingCapacity: pctToCapacity(claudePct),
  };

  const codex: AgentBudget = {
    agent: 'codex',
    monthlyCost: config.codex.cost,
    usagePercent: Math.round(codexPct),
    tasksCompleted: codexUsed,
    remainingCapacity: pctToCapacity(codexPct),
  };

  return {
    claude,
    codex,
    currentBias: config.routing.bias,
    activeWarnings: warnings.map(w => w.threshold),
    periodStart: new Date(Date.now() - fiveHoursMs).toISOString(),
    periodEnd: new Date().toISOString(),
    warnings,
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
 * @param taskId - The task identifier
 */
export async function recordTask(agent: RouteTarget, taskId: string): Promise<void> {
  if (agent === 'claude') {
    await recordClaudeMessage(taskId);
  } else {
    await recordCodexTask(taskId);
  }
}

/**
 * Get current budget warnings.
 *
 * @returns Array of active budget warnings
 */
export async function getWarnings(): Promise<BudgetWarning[]> {
  const status = await getBudgetStatus();
  return status.warnings;
}
