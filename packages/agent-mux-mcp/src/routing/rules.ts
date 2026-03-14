/**
 * Routing Rules
 * Defines and evaluates routing rules that determine whether a task goes to Claude or Codex.
 */

import type { RoutingRule, TaskSignals, RouteTarget } from '../types.js';

/** Default routing rules */
export const DEFAULT_RULES: RoutingRule[] = [];

/**
 * Evaluate all routing rules against the given task signals.
 *
 * @param signals - The extracted task signals
 * @param rules - The routing rules to evaluate
 * @returns The matched rule and target, or null if no rule matches
 */
export function evaluateRules(
  signals: TaskSignals,
  rules: RoutingRule[] = DEFAULT_RULES
): { rule: RoutingRule; target: RouteTarget } | null {
  // TODO: Implement rule evaluation
  throw new Error('Not implemented: evaluateRules');
}
