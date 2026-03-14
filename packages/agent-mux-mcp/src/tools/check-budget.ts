/**
 * Tool: check_budget
 * Checks remaining budget for Claude and/or Codex subscriptions.
 */

import { getBudgetStatus, getAgentBudget } from '../budget/tracker.js';
import type { CheckBudgetToolInput, BudgetStatus, AgentBudget } from '../types.js';

/**
 * Check the remaining budget for Claude and/or Codex.
 *
 * @param input - Optional agent filter
 * @returns Budget status for the requested agent(s)
 */
export async function checkBudget(input: CheckBudgetToolInput): Promise<BudgetStatus | AgentBudget> {
  if (input.agent) {
    return getAgentBudget(input.agent);
  }
  return getBudgetStatus();
}
