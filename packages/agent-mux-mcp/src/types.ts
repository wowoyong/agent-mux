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

// ─── Task Signals ────────────────────────────────────────────────────

/** Signals extracted from a task description to inform routing decisions */
export interface TaskSignals {
  /** Natural language description of the task */
  description: string;
  /** Estimated complexity: low, medium, high */
  complexity: 'low' | 'medium' | 'high';
  /** Whether the task requires multi-file coordination */
  multiFile: boolean;
  /** Whether the task needs deep architectural reasoning */
  needsReasoning: boolean;
  /** Whether the task involves UI/UX work */
  isUI: boolean;
  /** Whether the task is a simple refactor or rename */
  isRefactor: boolean;
  /** Whether the task involves test generation */
  isTestGen: boolean;
  /** Whether the task modifies security-sensitive files */
  isSensitive: boolean;
  /** Estimated number of files affected */
  estimatedFiles: number;
  /** Detected programming languages involved */
  languages: string[];
  /** File patterns relevant to the task */
  filePatterns: string[];
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

// ─── Codex Spawning ──────────────────────────────────────────────────

/** Input for spawning a Codex CLI process */
export interface SpawnCodexInput {
  /** The task prompt to send to Codex */
  prompt: string;
  /** Working directory for Codex */
  workdir: string;
  /** Whether to use a git worktree for isolation */
  useWorktree: boolean;
  /** Optional branch name for the worktree */
  branch?: string;
  /** Codex approval mode */
  approvalMode: 'suggest' | 'auto-edit' | 'full-auto';
  /** Maximum execution time in seconds */
  timeoutSeconds: number;
  /** Optional deny-list patterns */
  denyPatterns?: string[];
}

/** Output from a completed Codex CLI process */
export interface SpawnCodexOutput {
  /** Whether the task completed successfully */
  success: boolean;
  /** Exit code of the Codex process */
  exitCode: number;
  /** Unified diff of all changes */
  diff: string;
  /** Files that were modified */
  modifiedFiles: string[];
  /** Stdout from Codex */
  stdout: string;
  /** Stderr from Codex */
  stderr: string;
  /** Execution time in milliseconds */
  durationMs: number;
  /** The worktree path if one was used */
  worktreePath?: string;
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
  /** Optional deny-list patterns */
  denyList?: string[];
}

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
  workdir?: string;
  useWorktree?: boolean;
  approvalMode?: 'suggest' | 'auto-edit' | 'full-auto';
  timeoutSeconds?: number;
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
