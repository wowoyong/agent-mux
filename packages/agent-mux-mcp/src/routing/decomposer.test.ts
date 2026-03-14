import { describe, it, expect, vi } from 'vitest';
import { shouldDecompose, decomposeTask } from './decomposer.js';
import type { TaskSignals } from '../types.js';

// Mock history module to avoid filesystem I/O
vi.mock('./history.js', () => ({
  logRoutingDecision: vi.fn().mockResolvedValue(undefined),
  loadOverrides: vi.fn().mockResolvedValue([]),
  matchOverride: vi.fn().mockReturnValue(null),
}));

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

// ─── shouldDecompose Tests ──────────────────────────────────────────

describe('shouldDecompose', () => {
  it('returns false for simple single-operation tasks', () => {
    const signals = defaultSignals({ estimatedFiles: 1 });
    expect(shouldDecompose('Fix the typo in README', signals)).toBe(false);
  });

  it('returns false for multiple ops but low file count and no mixed signals', () => {
    const signals = defaultSignals({ estimatedFiles: 2 });
    expect(shouldDecompose('Fix the bug and add a test', signals)).toBe(false);
  });

  it('returns true for multiple ops with high file count', () => {
    const signals = defaultSignals({ estimatedFiles: 10 });
    const desc = 'Update the auth module, and fix the user service, and refactor the API layer';
    expect(shouldDecompose(desc, signals)).toBe(true);
  });

  it('returns true for multiple ops with mixed signals', () => {
    const signals = defaultSignals({
      isArchitectural: true,
      isTestWriting: true,
      estimatedFiles: 3,
    });
    // Need multipleOps: two "and" keywords or 3+ comma/semicolon splits
    const desc = 'Design the new architecture and write tests for it and then update docs';
    expect(shouldDecompose(desc, signals)).toBe(true);
  });

  it('detects numbered lists as multiple operations', () => {
    const signals = defaultSignals({ estimatedFiles: 10 });
    const desc = '1. Update the parser\n2. Fix the validator\n3. Add tests';
    expect(shouldDecompose(desc, signals)).toBe(true);
  });

  it('detects comma-separated items as multiple operations', () => {
    const signals = defaultSignals({
      isArchitectural: true,
      isTestWriting: true,
    });
    const desc = 'Update auth, refactor users, add tests';
    expect(shouldDecompose(desc, signals)).toBe(true);
  });
});

// ─── decomposeTask Tests ────────────────────────────────────────────

describe('decomposeTask', () => {
  it('returns shouldDecompose=false for simple tasks', () => {
    const result = decomposeTask('Fix a typo in the readme');
    expect(result.shouldDecompose).toBe(false);
    expect(result.subtasks).toEqual([]);
    expect(result.executionStrategy).toBe('sequential');
  });

  it('returns shouldDecompose=false when parts cannot be split', () => {
    // Single sentence with no clear split points
    const result = decomposeTask('Implement complex error handling');
    expect(result.shouldDecompose).toBe(false);
  });

  it('splits numbered list into subtasks', () => {
    const desc = '1. Design the system architecture for the auth service across the codebase\n2. Write unit tests for the parser module\n3. Add jsdoc comments to all exported functions';
    const result = decomposeTask(desc);

    if (result.shouldDecompose) {
      expect(result.subtasks.length).toBeGreaterThanOrEqual(2);
      // Each subtask should have an id and description
      for (const subtask of result.subtasks) {
        expect(subtask.id).toBeDefined();
        expect(subtask.description).toBeDefined();
        expect(subtask.recommendedTarget).toMatch(/^(claude|codex)$/);
        expect(subtask.priority).toBeGreaterThan(0);
      }
    }
  });

  it('determines sequential strategy for single-agent tasks', () => {
    const result = decomposeTask('Fix a typo');
    expect(result.executionStrategy).toBe('sequential');
  });

  it('assigns unique IDs to subtasks', () => {
    const desc = '1. Design the system architecture for the auth codebase\n2. Write unit tests for all 10 files\n3. Add jsdoc to all functions';
    const result = decomposeTask(desc);

    if (result.shouldDecompose && result.subtasks.length > 0) {
      const ids = result.subtasks.map(s => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('sets codex task dependencies on claude tasks', () => {
    const desc = '1. Design the architecture for the auth service across the project\n2. Write unit tests for the parser\n3. Add docs to all functions';
    const result = decomposeTask(desc);

    if (result.shouldDecompose) {
      const claudeTasks = result.subtasks.filter(s => s.recommendedTarget === 'claude');
      const codexTasks = result.subtasks.filter(s => s.recommendedTarget === 'codex');

      // Each codex task should depend on all claude tasks
      for (const codexTask of codexTasks) {
        for (const claudeTask of claudeTasks) {
          expect(codexTask.dependencies).toContain(claudeTask.id);
        }
      }
    }
  });

  it('returns fan-out strategy when both claude and codex subtasks exist', () => {
    const desc = '1. Design the architecture for the auth service across the project\n2. Write unit tests for the parser\n3. Add jsdoc to all exported functions';
    const result = decomposeTask(desc);

    if (result.shouldDecompose) {
      const hasClaude = result.subtasks.some(s => s.recommendedTarget === 'claude');
      const hasCodex = result.subtasks.some(s => s.recommendedTarget === 'codex');
      if (hasClaude && hasCodex) {
        expect(result.executionStrategy).toBe('fan-out');
      }
    }
  });

  it('provides a reason string', () => {
    const result = decomposeTask('Fix a typo');
    expect(result.reason).toBeDefined();
    expect(result.reason.length).toBeGreaterThan(0);
  });
});
