/**
 * Core type definitions for agent-mux.
 * Defines all interfaces used across the routing, spawning, and budget systems.
 */

// ─── Tier & Plan Types ───────────────────────────────────────────────

export type TierName = 'budget' | 'standard' | 'premium' | 'power';
export type ClaudePlan = 'pro' | 'max_5x' | 'max_20x';
export type CodexPlan = 'plus' | 'pro';
export type CodexMode = 'local' | 'cloud_and_local';
export type RoutingEngine = 'local' | 'hybrid';
export type RoutingBias = 'codex' | 'balanced' | 'claude' | 'adaptive';
export type EscalationStrategy = 'fix' | 'fix_then_redo' | 'full';

// ─── Task Signals (20-signal spec) ──────────────────────────────────

/** Signals extracted from a task description to inform routing decisions */
export interface TaskSignals {
  // Claude-favoring (8)
  /** Whether the task requires MCP tool access */
  needsMCP: boolean;
  /** Whether the task needs project-wide context */
  needsProjectContext: boolean;
  /** Whether the task needs conversation context */
  needsConversationContext: boolean;
  /** Whether the task requires interactive dialogue */
  isInteractive: boolean;
  /** Whether the task involves architectural decisions */
  isArchitectural: boolean;
  /** Whether the task involves frontend/UI work */
  isFrontend: boolean;
  /** Whether the task involves scaffolding new projects/files */
  isScaffolding: boolean;
  /** Whether the task requires multi-file orchestration */
  isMultiFileOrchestration: boolean;

  // Codex-favoring (8)
  /** Whether the task is a code review */
  isCodeReview: boolean;
  /** Whether the task is a security audit */
  isSecurityAudit: boolean;
  /** Whether the task is self-contained to a few files */
  isSelfContained: boolean;
  /** Whether the task involves writing tests */
  isTestWriting: boolean;
  /** Whether the task involves generating documentation */
  isDocGeneration: boolean;
  /** Whether the task involves debugging */
  isDebugging: boolean;
  /** Whether the task involves refactoring */
  isRefactoring: boolean;
  /** Whether the task is a terminal/CLI task */
  isTerminalTask: boolean;

  // Meta (4)
  /** Estimated number of files affected */
  estimatedFiles: number;
  /** Estimated complexity level */
  estimatedComplexity: 'low' | 'medium' | 'high';
  /** Whether the result can be verified automatically */
  isVerifiable: boolean;
  /** Whether the task is urgent */
  isUrgent: boolean;
}

// ─── Routing ─────────────────────────────────────────────────────────

/** The target agent for a routed task */
export type RouteTarget = 'claude' | 'codex';

/** Decision made by the routing engine */
export interface RouteDecision {
  /** Which agent should handle the task */
  target: RouteTarget;
  /** Confidence score 0-1 */
  confidence: number;
  /** Human-readable reason for the decision */
  reason: string;
  /** The signals that informed this decision */
  signals: TaskSignals;
  /** Whether this was escalated from a previous attempt */
  escalated: boolean;
  /** Routing rule that matched, if any */
  matchedRule?: string;
}

/** A routing rule definition */
export interface RoutingRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Priority (lower = higher priority) */
  priority: number;
  /** Condition function or pattern */
  condition: string;
  /** Target to route to when condition matches */
  target: RouteTarget;
  /** Whether this rule is enabled */
  enabled: boolean;
}

// ─── JSONL Events (Codex CLI v0.112.0) ──────────────────────────────

/** Event types emitted by Codex CLI in JSONL format */
export type JsonlEventType =
  | 'thread.started'
  | 'turn.started'
  | 'turn.completed'
  | 'item.started'
  | 'item.completed';

/** A single JSONL event from Codex CLI */
export interface JsonlEvent {
  /** Event type */
  type: JsonlEventType;
  /** Item data if applicable */
  item?: {
    type: string;
    content?: string;
  };
  /** Token usage if applicable */
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ─── Codex Spawning ──────────────────────────────────────────────────

/** Input for spawning a Codex CLI process */
export interface SpawnCodexInput {
  /** The task prompt to send to Codex */
  prompt: string;
  /** Path to the git worktree to use */
  worktreePath?: string;
  /** Maximum execution time in ms (default 420000 = 7 minutes) */
  timeout?: number;
  /** Task complexity hint */
  complexity?: 'low' | 'medium' | 'high';
  /** Files to provide as context */
  contextFiles?: string[];
  /** Verification strategy after completion */
  verifyStrategy?: 'tests' | 'lint' | 'diff-review' | 'none';
  /** File patterns Codex is not allowed to modify */
  denyList?: string[];
}

/** Output from a completed Codex CLI process */
export interface SpawnCodexOutput {
  /** Whether the task completed successfully */
  success: boolean;
  /** Unique task identifier */
  taskId: string;
  /** Path to the worktree used */
  worktreePath: string;
  /** Git branch name created */
  branchName: string;
  /** Files that were modified */
  filesModified: string[];
  /** Stdout from Codex */
  stdout: string;
  /** Stderr from Codex */
  stderr: string;
  /** Exit code of the Codex process */
  exitCode: number;
  /** Execution time in milliseconds */
  durationMs: number;
  /** Files that were denied (attempted but blocked) */
  deniedFiles: string[];
  /** Number of JSONL events captured */
  jsonlEvents: number;
}

// ─── Budget ──────────────────────────────────────────────────────────

/** Budget status for a single agent */
export interface AgentBudget {
  /** Agent name */
  agent: RouteTarget;
  /** Monthly cost in USD */
  monthlyCost: number;
  /** Estimated usage percentage (0-100) */
  usagePercent: number;
  /** Number of tasks completed this period */
  tasksCompleted: number;
  /** Estimated remaining capacity */
  remainingCapacity: 'high' | 'medium' | 'low' | 'exhausted';
}

/** Combined budget overview */
export interface BudgetStatus {
  /** Budget for Claude */
  claude: AgentBudget;
  /** Budget for Codex */
  codex: AgentBudget;
  /** Current routing bias */
  currentBias: RoutingBias;
  /** Warning thresholds that have been crossed */
  activeWarnings: number[];
  /** Period start date ISO string */
  periodStart: string;
  /** Period end date ISO string */
  periodEnd: string;
}

// ─── Configuration ───────────────────────────────────────────────────

/** Full mux configuration */
export interface MuxConfig {
  /** Schema version */
  schemaVersion: number;
  /** Selected tier */
  tier: TierName;
  /** Claude configuration */
  claude: {
    plan: ClaudePlan;
    cost: number;
  };
  /** Codex configuration */
  codex: {
    plan: CodexPlan;
    cost: number;
    mode: CodexMode;
  };
  /** Routing configuration */
  routing: {
    engine: RoutingEngine;
    bias: RoutingBias;
    split: {
      claude: number;
      codex: number;
    };
    escalation: {
      enabled: boolean;
      strategy: EscalationStrategy;
      maxRetries: number;
    };
  };
  /** Budget warning thresholds */
  budget: {
    warnings: number[];
  };
  /** Conservation settings */
  conservation?: {
    /** When true, prefer codex on uncertain routing decisions (saves Claude budget) */
    codexFirstOnUncertain?: boolean;
  };
  /** Optional deny-list patterns */
  denyList?: string[];
}

// ─── Deny List ───────────────────────────────────────────────────────

/** Default deny-list patterns for files Codex should not modify */
export const DEFAULT_DENY_LIST: string[] = [
  '.github/workflows/*',
  '.env*',
  '*.pem',
  '*.key',
  '*.p12',
  '*.jks',
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Gemfile.lock',
  'poetry.lock',
  'go.sum',
  'Cargo.lock',
  'Dockerfile',
  'docker-compose*.yml',
  'Makefile',
  '.npmrc',
  '.pypirc',
  'Jenkinsfile',
  '.circleci/*',
  '.gitlab-ci.yml',
  'CODEOWNERS',
];

// ─── Orchestration Status ────────────────────────────────────────────

/** Status of a single task in the orchestration queue */
export interface TaskStatus {
  /** Unique task ID */
  id: string;
  /** Task description */
  description: string;
  /** Which agent is handling the task */
  agent: RouteTarget;
  /** Current status */
  status: 'queued' | 'running' | 'completed' | 'failed' | 'escalated';
  /** Start time ISO string */
  startedAt?: string;
  /** Completion time ISO string */
  completedAt?: string;
  /** Error message if failed */
  error?: string;
}

/** Full orchestration status */
export interface MuxStatus {
  /** Current configuration summary */
  config: {
    tier: TierName;
    bias: RoutingBias;
  };
  /** Budget status */
  budget: BudgetStatus;
  /** Active and recent tasks */
  tasks: TaskStatus[];
  /** Uptime in milliseconds */
  uptimeMs: number;
}

// ─── MCP Tool Schemas ────────────────────────────────────────────────

/** Input schema for the spawn_codex MCP tool */
export interface SpawnCodexToolInput {
  prompt: string;
  worktreePath?: string;
  timeout?: number;
  complexity?: 'low' | 'medium' | 'high';
  contextFiles?: string[];
  verifyStrategy?: 'tests' | 'lint' | 'diff-review' | 'none';
  denyList?: string[];
}

/** Input schema for the check_budget MCP tool */
export interface CheckBudgetToolInput {
  agent?: RouteTarget;
}

/** Input schema for the get_mux_status MCP tool */
export interface GetMuxStatusToolInput {
  includeHistory?: boolean;
  limit?: number;
}

// ─── Detected Plugin ─────────────────────────────────────────────────

/** A detected sibling plugin */
export interface DetectedPlugin {
  /** Plugin name */
  name: string;
  /** Path to the plugin */
  path: string;
  /** Whether the plugin is available */
  available: boolean;
}

// ─── Retry & Escalation ─────────────────────────────────────────────

export interface RetryContext {
  attempt: number;
  maxAttempts: number;
  previousErrors: string[];
  previousDeniedFiles: string[];
  originalPrompt: string;
}

export interface EscalationResult {
  finalResult: SpawnCodexOutput;
  retryCount: number;
  escalatedToClaude: boolean;
  escalationReason?: string;
  retryHistory: Array<{
    attempt: number;
    exitCode: number;
    error: string;
    deniedFiles: string[];
  }>;
}

// ─── Budget Persistence ─────────────────────────────────────────────

export interface UsageRecord {
  timestamp: number;
  agent: RouteTarget;
  taskId: string;
  estimatedTokens?: number;
  success: boolean;
}

export interface BudgetWarning {
  level: 'info' | 'warn' | 'critical';
  threshold: number;       // e.g. 50, 75, 90
  agent: RouteTarget;
  message: string;
  usagePct: number;
}

// ─── Code Review ────────────────────────────────────────────────────

export type VerifyStrategy = 'tests' | 'lint' | 'diff-review' | 'none';

export interface ReviewResult {
  passed: boolean;
  strategy: VerifyStrategy;
  testsRan: boolean;
  testsPassed: boolean;
  typecheckPassed: boolean;
  lintPassed: boolean;
  diffSummary: string;
  issues: string[];
  stdout: string;
  stderr: string;
}

// ─── Routing Log & Learning ─────────────────────────────────────────

export interface RoutingLogEntry {
  timestamp: number;
  taskSummary: string;
  signals: Partial<TaskSignals>;
  decision: {
    target: RouteTarget;
    confidence: number;
    reason: string;
    phase: 1 | 2;
  };
  userOverride?: RouteTarget;
  outcome?: 'success' | 'failure' | 'escalated';
  durationMs?: number;
}

export interface LearnedOverride {
  signalPattern: Partial<TaskSignals>;
  forcedTarget: RouteTarget;
  count: number;
  lastUsed: number;
}

// ─── Task Decomposition ─────────────────────────────────────────────

export interface SubTask {
  id: string;
  description: string;
  recommendedTarget: RouteTarget;
  dependencies: string[];   // IDs of subtasks that must complete first
  estimatedFiles: number;
  priority: number;          // lower = higher priority
}

export interface DecompositionResult {
  shouldDecompose: boolean;
  reason: string;
  subtasks: SubTask[];
  executionStrategy: 'sequential' | 'parallel' | 'fan-out';
}
