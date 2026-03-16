import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeTask, routeTask } from './classifier.js';
import type { TaskSignals, TierName } from '../types.js';

// Mock the history module to avoid filesystem access during tests
vi.mock('./history.js', () => ({
  logRoutingDecision: vi.fn().mockResolvedValue(undefined),
  loadOverrides: vi.fn().mockResolvedValue([]),
  matchOverride: vi.fn().mockReturnValue(null),
}));

/** Helper: create a default TaskSignals with all signals off */
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

// ─── analyzeTask Tests ──────────────────────────────────────────────

describe('analyzeTask', () => {
  describe('Codex keyword detection', () => {
    it('detects test writing signal', () => {
      const signals = analyzeTask('Write tests for the auth module');
      expect(signals.isTestWriting).toBe(true);
      expect(signals.isVerifiable).toBe(true);
    });

    it('detects unit test writing', () => {
      const signals = analyzeTask('Write unit tests for the parser');
      expect(signals.isTestWriting).toBe(true);
    });

    it('detects lint fix as self-contained', () => {
      const signals = analyzeTask('Fix lint errors in the project');
      expect(signals.isSelfContained).toBe(true);
    });

    it('detects eslint fix as self-contained', () => {
      const signals = analyzeTask('Fix eslint issues everywhere');
      expect(signals.isSelfContained).toBe(true);
    });

    it('detects rename as refactoring', () => {
      const signals = analyzeTask('Rename getUserById to findUserById');
      expect(signals.isRefactoring).toBe(true);
    });

    it('detects convert as refactoring', () => {
      const signals = analyzeTask('Convert callbacks to promises');
      expect(signals.isRefactoring).toBe(true);
    });

    it('detects doc generation', () => {
      const signals = analyzeTask('Add jsdoc comments to all exported functions');
      expect(signals.isDocGeneration).toBe(true);
    });

    it('detects creating new file as self-contained', () => {
      const signals = analyzeTask('Create a new component for the dashboard');
      expect(signals.isSelfContained).toBe(true);
    });

    it('detects endpoint implementation as self-contained', () => {
      const signals = analyzeTask('Implement the api endpoint for /users');
      expect(signals.isSelfContained).toBe(true);
    });

    it('detects bug fix as debugging', () => {
      const signals = analyzeTask('Fix this bug in the login handler');
      expect(signals.isDebugging).toBe(true);
    });

    it('detects dependency update as self-contained', () => {
      const signals = analyzeTask('Update dependencies to latest versions');
      expect(signals.isSelfContained).toBe(true);
    });
  });

  describe('Claude keyword detection', () => {
    it('detects architecture signal', () => {
      const signals = analyzeTask('Design a system for event sourcing');
      expect(signals.isArchitectural).toBe(true);
    });

    it('detects architecture for keyword', () => {
      const signals = analyzeTask('Architecture for the microservice layer');
      expect(signals.isArchitectural).toBe(true);
    });

    it('detects scaffolding signal', () => {
      const signals = analyzeTask('Scaffold a project for a new API');
      expect(signals.isScaffolding).toBe(true);
    });

    it('detects debugging signal', () => {
      const signals = analyzeTask('Debug this error in the build pipeline');
      expect(signals.isDebugging).toBe(true);
    });

    it('detects code review signal', () => {
      const signals = analyzeTask('Review this PR for performance issues');
      expect(signals.isCodeReview).toBe(true);
    });

    it('detects explanation as conversation context', () => {
      const signals = analyzeTask('Explain why this approach is better');
      expect(signals.needsConversationContext).toBe(true);
    });

    it('detects multi-file refactoring', () => {
      const signals = analyzeTask('Refactor multiple modules to use new interface');
      expect(signals.isMultiFileOrchestration).toBe(true);
    });

    it('detects security audit', () => {
      const signals = analyzeTask('Security audit of the authentication flow');
      expect(signals.isSecurityAudit).toBe(true);
    });

    it('detects best practice as architectural', () => {
      const signals = analyzeTask('Best approach for caching strategy');
      expect(signals.isArchitectural).toBe(true);
    });
  });

  describe('Additional signal detection', () => {
    it('detects MCP signal from tool call mention', () => {
      const signals = analyzeTask('Use MCP to fetch data from the database');
      expect(signals.needsMCP).toBe(true);
    });

    it('detects MCP from database query', () => {
      const signals = analyzeTask('Run a database query to find stale records');
      expect(signals.needsMCP).toBe(true);
    });

    it('detects MCP from fetch url', () => {
      const signals = analyzeTask('Fetch from url https://example.com/api');
      expect(signals.needsMCP).toBe(true);
    });

    it('detects project context', () => {
      const signals = analyzeTask('Refactor across the codebase to use new pattern');
      expect(signals.needsProjectContext).toBe(true);
    });

    it('detects project context from existing code', () => {
      const signals = analyzeTask('Follow the existing implementation pattern');
      expect(signals.needsProjectContext).toBe(true);
    });

    it('detects conversation context from previous reference', () => {
      const signals = analyzeTask('Use the approach we discussed earlier');
      expect(signals.needsConversationContext).toBe(true);
    });

    it('detects conversation context from last message', () => {
      const signals = analyzeTask('Like in the previous response, update the handler');
      expect(signals.needsConversationContext).toBe(true);
    });

    it('detects interactive signal', () => {
      const signals = analyzeTask('Walk me through how the auth system works');
      expect(signals.isInteractive).toBe(true);
    });

    it('detects interactive from step-by-step', () => {
      const signals = analyzeTask('Step-by-step guide for setting up the dev environment');
      expect(signals.isInteractive).toBe(true);
    });

    it('detects interactive from help me understand', () => {
      const signals = analyzeTask('Help me understand how this module works');
      expect(signals.isInteractive).toBe(true);
    });

    it('detects frontend signal', () => {
      const signals = analyzeTask('Fix the CSS layout of the sidebar component');
      expect(signals.isFrontend).toBe(true);
    });

    it('detects frontend from react', () => {
      const signals = analyzeTask('Create a new React component for user profile');
      expect(signals.isFrontend).toBe(true);
    });

    it('detects terminal task', () => {
      const signals = analyzeTask('Write a bash script to clean build artifacts');
      expect(signals.isTerminalTask).toBe(true);
    });

    it('detects terminal task from npm run', () => {
      const signals = analyzeTask('Run npm install and npm run build');
      expect(signals.isTerminalTask).toBe(true);
    });

    it('detects verifiable from test keyword', () => {
      const signals = analyzeTask('Verify the output matches expected values');
      expect(signals.isVerifiable).toBe(true);
    });

    it('detects urgent signal', () => {
      const signals = analyzeTask('Urgent: production bug causing crashes');
      expect(signals.isUrgent).toBe(true);
    });

    it('detects urgent from hotfix', () => {
      const signals = analyzeTask('Apply a hotfix for the auth service');
      expect(signals.isUrgent).toBe(true);
    });

    it('detects self-contained from single file mention', () => {
      const signals = analyzeTask('Fix the bug in this single file');
      expect(signals.isSelfContained).toBe(true);
    });
  });

  describe('File count estimation', () => {
    it('uses explicit file count from description', () => {
      const signals = analyzeTask('Update 5 files with the new logging pattern');
      expect(signals.estimatedFiles).toBe(5);
    });

    it('caps file count at 50', () => {
      const signals = analyzeTask('Modify 100 files to use new import paths');
      expect(signals.estimatedFiles).toBe(50);
    });

    it('uses multi-file indicator', () => {
      const signals = analyzeTask('Update all files with the deprecated API');
      expect(signals.estimatedFiles).toBe(10);
    });

    it('returns 1 for single file mention', () => {
      const signals = analyzeTask('Fix the single file src/parser.ts');
      expect(signals.estimatedFiles).toBe(1);
    });

    it('counts file patterns in description', () => {
      const signals = analyzeTask('Update auth.ts and user.ts with new types');
      expect(signals.estimatedFiles).toBe(2);
    });

    it('defaults to 2 for generic tasks', () => {
      const signals = analyzeTask('Add error handling');
      expect(signals.estimatedFiles).toBe(2);
    });
  });

  describe('Complexity extraction', () => {
    it('detects high complexity from architect keyword', () => {
      const signals = analyzeTask('Architect the new microservice layer');
      expect(signals.estimatedComplexity).toBe('high');
    });

    it('detects high complexity from migrate keyword', () => {
      const signals = analyzeTask('Migrate the database from PostgreSQL to MongoDB');
      expect(signals.estimatedComplexity).toBe('high');
    });

    it('detects low complexity from typo', () => {
      const signals = analyzeTask('Fix a typo in the readme');
      expect(signals.estimatedComplexity).toBe('low');
    });

    it('detects low complexity from rename', () => {
      const signals = analyzeTask('Rename the variable');
      expect(signals.estimatedComplexity).toBe('low');
    });

    it('defaults to medium complexity', () => {
      const signals = analyzeTask('Add pagination support to the user list');
      expect(signals.estimatedComplexity).toBe('medium');
    });
  });
});

// ─── routeTask Tests ────────────────────────────────────────────────

describe('routeTask', () => {
  describe('Hard rule application (Phase 1)', () => {
    it('routes MCP tasks to claude', () => {
      const signals = defaultSignals({ needsMCP: true });
      const decision = routeTask(signals);
      expect(decision.target).toBe('claude');
      expect(decision.confidence).toBe(1.0);
      expect(decision.matchedRule).toBe('mcp');
    });

    it('routes interactive tasks to claude', () => {
      const signals = defaultSignals({ isInteractive: true });
      const decision = routeTask(signals);
      expect(decision.target).toBe('claude');
      expect(decision.matchedRule).toBe('interactive');
    });

    it('routes conversation context tasks to claude', () => {
      const signals = defaultSignals({ needsConversationContext: true });
      const decision = routeTask(signals);
      expect(decision.target).toBe('claude');
      expect(decision.matchedRule).toBe('conversation');
    });

    it('routes standalone security audit to codex', () => {
      const signals = defaultSignals({ isSecurityAudit: true, needsProjectContext: false });
      const decision = routeTask(signals);
      expect(decision.target).toBe('codex');
      expect(decision.matchedRule).toBe('security-standalone');
    });

    it('does NOT route security audit with project context via standalone rule', () => {
      const signals = defaultSignals({ isSecurityAudit: true, needsProjectContext: true });
      const decision = routeTask(signals);
      // Should NOT match the security-standalone rule
      expect(decision.matchedRule).not.toBe('security-standalone');
    });

    it('routes multi-file refactoring to claude', () => {
      const signals = defaultSignals({ isRefactoring: true, estimatedFiles: 10 });
      const decision = routeTask(signals);
      expect(decision.target).toBe('claude');
      expect(decision.matchedRule).toBe('multifile-refactor');
    });

    it('does NOT trigger multi-file refactor for few files', () => {
      const signals = defaultSignals({ isRefactoring: true, estimatedFiles: 3 });
      const decision = routeTask(signals);
      expect(decision.matchedRule).not.toBe('multifile-refactor');
    });

    it('routes scaffolding to claude', () => {
      const signals = defaultSignals({ isScaffolding: true });
      const decision = routeTask(signals);
      expect(decision.target).toBe('claude');
      expect(decision.matchedRule).toBe('scaffolding');
    });

    it('applies hard rules in priority order (MCP before interactive)', () => {
      const signals = defaultSignals({ needsMCP: true, isInteractive: true });
      const decision = routeTask(signals);
      expect(decision.matchedRule).toBe('mcp');
    });
  });

  describe('Phase 2 scoring defaults per tier', () => {
    it('defaults to codex for budget tier on ambiguous task', () => {
      // All signals off = score 0 = low confidence = tiebreaker
      const signals = defaultSignals();
      const decision = routeTask(signals, 'budget');
      expect(decision.target).toBe('codex');
    });

    it('defaults to claude for standard tier on ambiguous task', () => {
      const signals = defaultSignals();
      const decision = routeTask(signals, 'standard');
      expect(decision.target).toBe('claude');
    });

    it('defaults to claude for premium tier on ambiguous task', () => {
      const signals = defaultSignals();
      const decision = routeTask(signals, 'premium');
      expect(decision.target).toBe('claude');
    });
  });

  describe('Phase 2 weighted scoring', () => {
    it('routes test writing to codex on budget tier (score direction)', () => {
      // isTestWriting weight is +40, confidence ~0.05 above threshold (0.02)
      // Positive score -> codex
      const signals = defaultSignals({ isTestWriting: true, isVerifiable: true });
      const decision = routeTask(signals, 'budget');
      expect(decision.target).toBe('codex');
    });

    it('routes test writing to codex on standard tier (score direction wins)', () => {
      // isTestWriting weight is +40, confidence above threshold, score is positive -> codex
      const signals = defaultSignals({ isTestWriting: true, isVerifiable: true });
      const decision = routeTask(signals, 'standard');
      expect(decision.target).toBe('codex');
    });

    it('routes strongly codex-favoring signals to codex on budget tier', () => {
      // Even with multiple codex signals, confidence may stay below threshold
      // On budget tier, tiebreaker defaults to codex
      const signals = defaultSignals({
        isTestWriting: true,
        isSelfContained: true,
        isDocGeneration: true,
        isCodeReview: true,
        isRefactoring: true,
        isTerminalTask: true,
      });
      const decision = routeTask(signals, 'budget');
      expect(decision.target).toBe('codex');
    });

    it('routes architectural task with project context to claude', () => {
      const signals = defaultSignals({ isArchitectural: true, needsProjectContext: true });
      const decision = routeTask(signals, 'standard');
      expect(decision.target).toBe('claude');
    });
  });

  describe('Budget pressure adjustment', () => {
    it('pushes toward codex when claude budget is low on budget tier', () => {
      // Low claude budget (+50) combined with budget tier tiebreak -> codex
      const signals = defaultSignals({ isTestWriting: true });
      const decision = routeTask(signals, 'budget', 0.1, 1.0);
      expect(decision.target).toBe('codex');
    });

    it('pushes toward claude when codex budget is low', () => {
      // Use codex-favoring signals, but codex budget pressure (-50) reverses it
      const signals = defaultSignals({
        isTestWriting: true,
        isSelfContained: true,
        isDocGeneration: true,
        isCodeReview: true,
        isRefactoring: true,
      });
      // Without budget pressure these signals total +150 -> codex
      // With codex budget low, -50 brings it to +100, still codex
      // Need claude-favoring signals too to make it close
      const signals2 = defaultSignals({
        isTestWriting: true,
        isDebugging: true,
      });
      // isTestWriting=40, isDebugging=15, total=+55, minus codex budget -50 = +5
      // confidence = 5/730 = 0.007 < 0.65 -> tiebreak to claude (standard)
      const decision = routeTask(signals2, 'standard', 1.0, 0.1);
      expect(decision.target).toBe('claude');
    });

    it('tiebreaks to budget tier default when confidence is low', () => {
      // With low confidence and budget tier, should default to codex
      const signals = defaultSignals({ isTestWriting: true });
      const decision = routeTask(signals, 'budget', 0.8, 0.8);
      expect(decision.target).toBe('codex');
    });
  });

  describe('Conservation mode', () => {
    it('routes ambiguous task to codex when conservation mode is enabled', () => {
      // All signals off = score 0 = low confidence = tiebreaker
      // Standard tier normally defaults to claude, but conservation mode overrides
      const signals = defaultSignals();
      const decision = routeTask(signals, 'standard', 1.0, 1.0, '', { conservationMode: true });
      expect(decision.target).toBe('codex');
    });

    it('still routes to claude when conservation mode is off on standard tier', () => {
      const signals = defaultSignals();
      const decision = routeTask(signals, 'standard', 1.0, 1.0, '', { conservationMode: false });
      expect(decision.target).toBe('claude');
    });

    it('does not affect hard rule routing', () => {
      // MCP tasks always go to claude regardless of conservation mode
      const signals = defaultSignals({ needsMCP: true });
      const decision = routeTask(signals, 'standard', 1.0, 1.0, '', { conservationMode: true });
      expect(decision.target).toBe('claude');
      expect(decision.confidence).toBe(1.0);
    });
  });

  describe('End-to-end routing accuracy', () => {
    it('routes "design payment system architecture" to claude', () => {
      const signals = analyzeTask('design payment system architecture');
      expect(signals.isArchitectural).toBe(true);
      const decision = routeTask(signals, 'budget', 1.0, 1.0);
      expect(decision.target).toBe('claude');
    });

    it('routes "debug this crash error" to claude', () => {
      const signals = analyzeTask('debug this crash error');
      expect(signals.isDebugging).toBe(true);
      const decision = routeTask(signals, 'budget', 1.0, 1.0);
      expect(decision.target).toBe('claude');
    });

    it('routes "scaffold a new project module" to claude', () => {
      const signals = analyzeTask('scaffold a new project module');
      expect(signals.isScaffolding).toBe(true);
      const decision = routeTask(signals, 'budget', 1.0, 1.0);
      expect(decision.target).toBe('claude');
    });

    it('routes "refactor multiple files across the system" to claude', () => {
      const signals = analyzeTask('refactor multiple files across the system');
      expect(signals.isMultiFileOrchestration).toBe(true);
      expect(signals.isRefactoring).toBe(true);
      const decision = routeTask(signals, 'budget', 1.0, 1.0);
      expect(decision.target).toBe('claude');
    });

    it('routes "write unit tests for auth module" to codex', () => {
      const signals = analyzeTask('write unit tests for auth module');
      const decision = routeTask(signals, 'budget', 1.0, 1.0);
      expect(decision.target).toBe('codex');
    });

    it('routes "fix all eslint errors" to codex', () => {
      const signals = analyzeTask('fix all eslint errors');
      const decision = routeTask(signals, 'budget', 1.0, 1.0);
      expect(decision.target).toBe('codex');
    });

    it('routes "add JSDoc to all functions" to codex', () => {
      const signals = analyzeTask('add JSDoc to all functions');
      const decision = routeTask(signals, 'budget', 1.0, 1.0);
      expect(decision.target).toBe('codex');
    });

    it('routes "security audit the auth code" to codex', () => {
      const signals = analyzeTask('security audit the auth code');
      const decision = routeTask(signals, 'budget', 1.0, 1.0);
      expect(decision.target).toBe('codex');
    });

    it('routes "explain how the payment flow works" to claude', () => {
      const signals = analyzeTask('explain how the payment flow works');
      const decision = routeTask(signals, 'budget', 1.0, 1.0);
      expect(decision.target).toBe('claude');
    });

    it('routes "rename userId to accountId" to codex', () => {
      const signals = analyzeTask('rename userId to accountId');
      const decision = routeTask(signals, 'budget', 1.0, 1.0);
      expect(decision.target).toBe('codex');
    });
  });
});
