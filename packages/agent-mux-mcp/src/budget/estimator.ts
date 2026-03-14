/**
 * Budget Estimator
 * Estimates remaining budget based on tier limits, current usage, and time windows.
 */

import type { TaskSignals, RouteTarget, TierName } from '../types.js';
import { TIER_LIMITS } from '../config/tiers.js';

/** Estimated cost for a task */
export interface CostEstimate {
  /** Estimated relative cost (0-1 scale of monthly budget) */
  relativeCost: number;
  /** Confidence in the estimate (0-1) */
  confidence: number;
  /** Factors that influenced the estimate */
  factors: string[];
}

/**
 * Estimate the remaining budget within a 5-hour window.
 *
 * @param tier - Current subscription tier
 * @param used - Number of messages/tasks used in the current window
 * @param windowStartMs - Timestamp when the current window started
 * @returns Remaining count, percentage, and time until reset
 */
export function estimateRemainingBudget(
  tier: TierName,
  used: number,
  windowStartMs: number
): { remaining: number; pct: number; resetInMs: number } {
  const limits = TIER_LIMITS[tier];
  const windowMs = 5 * 60 * 60 * 1000; // 5 hours
  const elapsed = Date.now() - windowStartMs;
  const resetInMs = Math.max(0, windowMs - elapsed);
  const total = limits.claudeMsg5hr;
  const remaining = Math.max(0, total - used);
  const pct = total > 0 ? remaining / total : 0;
  return { remaining, pct, resetInMs };
}

/**
 * Estimate the cost of routing a task to a specific agent.
 *
 * @param signals - The task signals
 * @param target - The target agent
 * @returns Cost estimate for the task
 */
export function estimateCost(signals: TaskSignals, target: RouteTarget): CostEstimate {
  const factors: string[] = [];
  let relativeCost = 0.01; // base cost per task

  if (signals.estimatedComplexity === 'high') {
    relativeCost += 0.03;
    factors.push('high complexity');
  } else if (signals.estimatedComplexity === 'medium') {
    relativeCost += 0.015;
    factors.push('medium complexity');
  }

  if (signals.estimatedFiles > 5) {
    relativeCost += 0.02;
    factors.push(`${signals.estimatedFiles} estimated files`);
  }

  if (target === 'claude' && signals.isMultiFileOrchestration) {
    relativeCost += 0.02;
    factors.push('multi-file orchestration');
  }

  if (target === 'codex' && signals.isTestWriting) {
    relativeCost += 0.01;
    factors.push('test writing');
  }

  return {
    relativeCost: Math.min(relativeCost, 1.0),
    confidence: 0.5, // heuristic estimate
    factors,
  };
}

/**
 * Check if usage has crossed any warning thresholds.
 *
 * @param usagePct - Current usage percentage (0-100)
 * @param thresholds - Warning thresholds to check against
 * @returns The highest crossed threshold, or null if none crossed
 */
export function shouldWarn(usagePct: number, thresholds: number[]): number | null {
  const crossed = thresholds.filter(t => usagePct >= t);
  return crossed.length > 0 ? Math.max(...crossed) : null;
}
