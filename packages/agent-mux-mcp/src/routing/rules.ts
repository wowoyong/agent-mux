/**
 * Routing Rules
 * Defines hard rules (Phase 1) and default soft rules for routing decisions.
 */

import type { RoutingRule, TaskSignals, RouteTarget } from '../types.js';

// ─── Hard Rules (Phase 1) ───────────────────────────────────────────

export interface HardRule {
  id: string;
  priority: number;
  condition: (signals: TaskSignals) => boolean;
  target: RouteTarget;
  reason: string;
}

export const HARD_RULES: HardRule[] = [
  {
    id: 'mcp',
    priority: 1,
    condition: (s) => s.needsMCP,
    target: 'claude',
    reason: 'Task requires MCP integrations',
  },
  {
    id: 'interactive',
    priority: 2,
    condition: (s) => s.isInteractive,
    target: 'claude',
    reason: 'Task requires interactive feedback',
  },
  {
    id: 'conversation',
    priority: 3,
    condition: (s) => s.needsConversationContext,
    target: 'claude',
    reason: 'Task references conversation context',
  },
  {
    id: 'security-standalone',
    priority: 4,
    condition: (s) => s.isSecurityAudit && !s.needsProjectContext,
    target: 'codex',
    reason: 'Standalone security audit',
  },
  {
    id: 'multifile-refactor',
    priority: 5,
    condition: (s) => s.isRefactoring && s.estimatedFiles > 5,
    target: 'claude',
    reason: 'Multi-file refactoring needs coordination',
  },
  {
    id: 'scaffolding',
    priority: 6,
    condition: (s) => s.isScaffolding,
    target: 'claude',
    reason: 'Scaffolding needs project understanding',
  },
];

// ─── Default Soft Rules (legacy RoutingRule format) ─────────────────

/** Default routing rules (soft rules for backward compatibility) */
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
  for (const rule of rules.sort((a, b) => a.priority - b.priority)) {
    if (!rule.enabled) continue;
    // Soft rules use string-based conditions; not used for hard routing
    // This is kept for backward compatibility with the RoutingRule interface
  }
  return null;
}

/**
 * Evaluate hard rules against task signals (Phase 1 routing).
 * Returns the first matching rule in priority order, or null.
 */
export function evaluateHardRules(
  signals: TaskSignals
): { rule: HardRule; target: RouteTarget } | null {
  const sorted = [...HARD_RULES].sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    if (rule.condition(signals)) {
      return { rule, target: rule.target };
    }
  }
  return null;
}
