import { describe, it, expect } from 'vitest';
import { HARD_RULES, evaluateHardRules } from './rules.js';
import type { TaskSignals } from '../types.js';

/** Helper: create default signals with all booleans false */
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

describe('HARD_RULES', () => {
  it('has rules sorted by priority (lower = higher)', () => {
    const sorted = [...HARD_RULES].sort((a, b) => a.priority - b.priority);
    expect(sorted.map(r => r.id)).toEqual(HARD_RULES.map(r => r.id));
  });

  it('has unique IDs', () => {
    const ids = HARD_RULES.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique priorities', () => {
    const priorities = HARD_RULES.map(r => r.priority);
    expect(new Set(priorities).size).toBe(priorities.length);
  });
});

describe('evaluateHardRules', () => {
  it('returns null for ambiguous task (all signals off)', () => {
    const result = evaluateHardRules(defaultSignals());
    expect(result).toBeNull();
  });

  describe('MCP rule', () => {
    it('routes MCP to claude', () => {
      const result = evaluateHardRules(defaultSignals({ needsMCP: true }));
      expect(result).not.toBeNull();
      expect(result!.target).toBe('claude');
      expect(result!.rule.id).toBe('mcp');
    });
  });

  describe('Interactive rule', () => {
    it('routes interactive to claude', () => {
      const result = evaluateHardRules(defaultSignals({ isInteractive: true }));
      expect(result).not.toBeNull();
      expect(result!.target).toBe('claude');
      expect(result!.rule.id).toBe('interactive');
    });
  });

  describe('Conversation context rule', () => {
    it('routes conversation context to claude', () => {
      const result = evaluateHardRules(defaultSignals({ needsConversationContext: true }));
      expect(result).not.toBeNull();
      expect(result!.target).toBe('claude');
      expect(result!.rule.id).toBe('conversation');
    });
  });

  describe('Security audit rules', () => {
    it('routes standalone security audit to codex', () => {
      const result = evaluateHardRules(defaultSignals({
        isSecurityAudit: true,
        needsProjectContext: false,
      }));
      expect(result).not.toBeNull();
      expect(result!.target).toBe('codex');
      expect(result!.rule.id).toBe('security-standalone');
    });

    it('does NOT match standalone rule when project context is needed', () => {
      const result = evaluateHardRules(defaultSignals({
        isSecurityAudit: true,
        needsProjectContext: true,
      }));
      // Should not match security-standalone because needsProjectContext is true
      if (result) {
        expect(result.rule.id).not.toBe('security-standalone');
      }
    });
  });

  describe('Multi-file refactoring rule', () => {
    it('routes multi-file refactoring to claude', () => {
      const result = evaluateHardRules(defaultSignals({
        isRefactoring: true,
        estimatedFiles: 10,
      }));
      expect(result).not.toBeNull();
      expect(result!.target).toBe('claude');
      expect(result!.rule.id).toBe('multifile-refactor');
    });

    it('does not trigger for small refactoring', () => {
      const result = evaluateHardRules(defaultSignals({
        isRefactoring: true,
        estimatedFiles: 3,
      }));
      // Should not match multifile-refactor (needs > 5 files)
      if (result) {
        expect(result.rule.id).not.toBe('multifile-refactor');
      }
    });

    it('boundary: exactly 5 files does not trigger', () => {
      const result = evaluateHardRules(defaultSignals({
        isRefactoring: true,
        estimatedFiles: 5,
      }));
      if (result) {
        expect(result.rule.id).not.toBe('multifile-refactor');
      }
    });

    it('boundary: 6 files triggers', () => {
      const result = evaluateHardRules(defaultSignals({
        isRefactoring: true,
        estimatedFiles: 6,
      }));
      expect(result).not.toBeNull();
      expect(result!.rule.id).toBe('multifile-refactor');
    });
  });

  describe('Scaffolding rule', () => {
    it('routes scaffolding to claude', () => {
      const result = evaluateHardRules(defaultSignals({ isScaffolding: true }));
      expect(result).not.toBeNull();
      expect(result!.target).toBe('claude');
      expect(result!.rule.id).toBe('scaffolding');
    });
  });

  describe('Priority ordering', () => {
    it('MCP wins over interactive when both are true', () => {
      const result = evaluateHardRules(defaultSignals({
        needsMCP: true,
        isInteractive: true,
      }));
      expect(result!.rule.id).toBe('mcp');
    });

    it('interactive wins over scaffolding', () => {
      const result = evaluateHardRules(defaultSignals({
        isInteractive: true,
        isScaffolding: true,
      }));
      expect(result!.rule.id).toBe('interactive');
    });

    it('security-standalone wins over scaffolding', () => {
      const result = evaluateHardRules(defaultSignals({
        isSecurityAudit: true,
        isScaffolding: true,
      }));
      expect(result!.rule.id).toBe('security-standalone');
    });
  });
});
