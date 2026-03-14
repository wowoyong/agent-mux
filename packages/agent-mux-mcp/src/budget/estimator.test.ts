import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { estimateRemainingBudget, estimateCost, shouldWarn } from './estimator.js';
import type { TaskSignals, TierName } from '../types.js';

/** Helper: create default signals */
function defaultSignals(overrides: Partial<TaskSignals> = {}): TaskSignals {
  return {
    needsMCP: false,
    needsProjectContext: false,
    needsConversationContext: false,
    isInteractive: false,
    isArchitectural: false,
    isFrontend: false,
    isScaffolding: false,
    isMultiFileOrchestration: false,
    isCodeReview: false,
    isSecurityAudit: false,
    isSelfContained: false,
    isTestWriting: false,
    isDocGeneration: false,
    isDebugging: false,
    isRefactoring: false,
    isTerminalTask: false,
    estimatedFiles: 1,
    estimatedComplexity: 'medium',
    isVerifiable: false,
    isUrgent: false,
    ...overrides,
  };
}

// ─── estimateRemainingBudget Tests ──────────────────────────────────

describe('estimateRemainingBudget', () => {
  it('calculates remaining budget for budget tier', () => {
    const now = Date.now();
    const result = estimateRemainingBudget('budget', 10, now);
    // budget tier has claudeMsg5hr = 45
    expect(result.remaining).toBe(35);
    expect(result.pct).toBeCloseTo(35 / 45, 2);
  });

  it('calculates remaining budget for standard tier', () => {
    const now = Date.now();
    const result = estimateRemainingBudget('standard', 100, now);
    // standard tier has claudeMsg5hr = 225
    expect(result.remaining).toBe(125);
    expect(result.pct).toBeCloseTo(125 / 225, 2);
  });

  it('calculates remaining budget for premium tier', () => {
    const now = Date.now();
    const result = estimateRemainingBudget('premium', 500, now);
    // premium tier has claudeMsg5hr = 900
    expect(result.remaining).toBe(400);
  });

  it('calculates remaining budget for power tier', () => {
    const now = Date.now();
    const result = estimateRemainingBudget('power', 0, now);
    // power tier has claudeMsg5hr = 900
    expect(result.remaining).toBe(900);
    expect(result.pct).toBe(1);
  });

  it('clamps remaining to 0 when over budget', () => {
    const now = Date.now();
    const result = estimateRemainingBudget('budget', 100, now);
    // budget tier has claudeMsg5hr = 45, used 100
    expect(result.remaining).toBe(0);
    expect(result.pct).toBe(0);
  });

  it('calculates reset time correctly', () => {
    const fiveHoursMs = 5 * 60 * 60 * 1000;
    const windowStart = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
    const result = estimateRemainingBudget('budget', 0, windowStart);
    // Should be approximately 3 hours left
    const threeHoursMs = 3 * 60 * 60 * 1000;
    expect(result.resetInMs).toBeGreaterThan(threeHoursMs - 1000);
    expect(result.resetInMs).toBeLessThan(threeHoursMs + 1000);
  });

  it('returns 0 resetInMs when window has elapsed', () => {
    const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000);
    const result = estimateRemainingBudget('budget', 0, sixHoursAgo);
    expect(result.resetInMs).toBe(0);
  });

  it('returns full budget when nothing used', () => {
    const now = Date.now();
    const result = estimateRemainingBudget('budget', 0, now);
    expect(result.remaining).toBe(45);
    expect(result.pct).toBeCloseTo(1.0, 2);
  });
});

// ─── estimateCost Tests ─────────────────────────────────────────────

describe('estimateCost', () => {
  it('returns base cost for simple task', () => {
    const signals = defaultSignals({ estimatedComplexity: 'low' });
    const cost = estimateCost(signals, 'codex');
    expect(cost.relativeCost).toBe(0.01);
    expect(cost.factors).toEqual([]);
  });

  it('adds cost for high complexity', () => {
    const signals = defaultSignals({ estimatedComplexity: 'high' });
    const cost = estimateCost(signals, 'claude');
    expect(cost.relativeCost).toBeGreaterThan(0.01);
    expect(cost.factors).toContain('high complexity');
  });

  it('adds cost for medium complexity', () => {
    const signals = defaultSignals({ estimatedComplexity: 'medium' });
    const cost = estimateCost(signals, 'claude');
    expect(cost.relativeCost).toBeGreaterThan(0.01);
    expect(cost.factors).toContain('medium complexity');
  });

  it('adds cost for many files', () => {
    const signals = defaultSignals({ estimatedFiles: 10, estimatedComplexity: 'low' });
    const cost = estimateCost(signals, 'codex');
    expect(cost.factors).toContain('10 estimated files');
  });

  it('does not add file cost for <= 5 files', () => {
    const signals = defaultSignals({ estimatedFiles: 5, estimatedComplexity: 'low' });
    const cost = estimateCost(signals, 'codex');
    expect(cost.factors).not.toContain('5 estimated files');
  });

  it('adds multi-file orchestration cost for claude', () => {
    const signals = defaultSignals({ isMultiFileOrchestration: true, estimatedComplexity: 'low' });
    const cost = estimateCost(signals, 'claude');
    expect(cost.factors).toContain('multi-file orchestration');
  });

  it('does not add multi-file orchestration cost for codex', () => {
    const signals = defaultSignals({ isMultiFileOrchestration: true, estimatedComplexity: 'low' });
    const cost = estimateCost(signals, 'codex');
    expect(cost.factors).not.toContain('multi-file orchestration');
  });

  it('adds test writing cost for codex', () => {
    const signals = defaultSignals({ isTestWriting: true, estimatedComplexity: 'low' });
    const cost = estimateCost(signals, 'codex');
    expect(cost.factors).toContain('test writing');
  });

  it('does not add test writing cost for claude', () => {
    const signals = defaultSignals({ isTestWriting: true, estimatedComplexity: 'low' });
    const cost = estimateCost(signals, 'claude');
    expect(cost.factors).not.toContain('test writing');
  });

  it('caps relative cost at 1.0', () => {
    const signals = defaultSignals({
      estimatedComplexity: 'high',
      estimatedFiles: 50,
      isMultiFileOrchestration: true,
      isTestWriting: true,
    });
    const cost = estimateCost(signals, 'claude');
    expect(cost.relativeCost).toBeLessThanOrEqual(1.0);
  });

  it('always returns confidence of 0.5', () => {
    const cost = estimateCost(defaultSignals(), 'codex');
    expect(cost.confidence).toBe(0.5);
  });
});

// ─── shouldWarn Tests ───────────────────────────────────────────────

describe('shouldWarn', () => {
  const thresholds = [50, 75, 90];

  it('returns null when usage is below all thresholds', () => {
    expect(shouldWarn(30, thresholds)).toBeNull();
  });

  it('returns 50 when usage is at 50%', () => {
    expect(shouldWarn(50, thresholds)).toBe(50);
  });

  it('returns 75 when usage is at 80%', () => {
    expect(shouldWarn(80, thresholds)).toBe(75);
  });

  it('returns 90 when usage is at 95%', () => {
    expect(shouldWarn(95, thresholds)).toBe(90);
  });

  it('returns 90 when usage is at 100%', () => {
    expect(shouldWarn(100, thresholds)).toBe(90);
  });

  it('returns highest crossed threshold', () => {
    expect(shouldWarn(91, [25, 50, 75, 90])).toBe(90);
  });

  it('returns null for empty thresholds', () => {
    expect(shouldWarn(80, [])).toBeNull();
  });

  it('handles single threshold', () => {
    expect(shouldWarn(60, [50])).toBe(50);
    expect(shouldWarn(40, [50])).toBeNull();
  });

  it('returns threshold when usage exactly equals it', () => {
    expect(shouldWarn(75, thresholds)).toBe(75);
  });

  it('handles 0 usage', () => {
    expect(shouldWarn(0, thresholds)).toBeNull();
  });
});
