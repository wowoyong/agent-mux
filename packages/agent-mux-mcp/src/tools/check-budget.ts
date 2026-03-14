/**
 * Tool: check_budget
 * Checks remaining budget for Claude and/or Codex subscriptions.
 */

import type { CheckBudgetToolInput, BudgetStatus, AgentBudget } from '../types.js';

/**
 * Check the remaining budget for Claude and/or Codex.
 *
 * @param input - Optional agent filter
 * @returns Budget status for the requested agent(s)
 */
export async function checkBudget(input: CheckBudgetToolInput): Promise<BudgetStatus | AgentBudget> {
  // TODO: Implement budget checking
  throw new Error('Not implemented: checkBudget');
}
