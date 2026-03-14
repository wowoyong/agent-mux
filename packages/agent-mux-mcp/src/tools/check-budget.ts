/**
 * Tool: check_budget
 * Checks remaining budget for Claude and/or Codex subscriptions.
 * Includes warnings when usage thresholds are crossed.
 */

import { getBudgetStatus, getAgentBudget } from '../budget/tracker.js';
import type { CheckBudgetToolInput, BudgetStatus, AgentBudget, BudgetWarning } from '../types.js';

/**
 * Check the remaining budget for Claude and/or Codex.
 *
 * @param input - Optional agent filter
 * @returns Budget status for the requested agent(s), including warnings
 */
export async function checkBudget(input: CheckBudgetToolInput): Promise<(BudgetStatus & { warnings: BudgetWarning[] }) | AgentBudget> {
  if (input.agent) {
    return getAgentBudget(input.agent);
  }
  return getBudgetStatus();
}
