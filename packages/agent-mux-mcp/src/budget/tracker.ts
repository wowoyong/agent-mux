/**
 * Budget Tracker
 * Tracks usage and remaining budget for Claude and Codex subscriptions.
 */

import type { BudgetStatus, AgentBudget, RouteTarget } from '../types.js';

/**
 * Get the current budget status for all agents.
 *
 * @returns Combined budget status
 */
export async function getBudgetStatus(): Promise<BudgetStatus> {
  // TODO: Implement budget status retrieval
  throw new Error('Not implemented: getBudgetStatus');
}

/**
 * Get the budget status for a specific agent.
 *
 * @param agent - The agent to check
 * @returns Budget status for the specified agent
 */
export async function getAgentBudget(agent: RouteTarget): Promise<AgentBudget> {
  // TODO: Implement agent budget retrieval
  throw new Error('Not implemented: getAgentBudget');
}

/**
 * Record a task completion against the budget.
 *
 * @param agent - The agent that completed the task
 * @param taskId - The task identifier
 */
export async function recordTask(agent: RouteTarget, taskId: string): Promise<void> {
  // TODO: Implement task recording
  throw new Error('Not implemented: recordTask');
}
