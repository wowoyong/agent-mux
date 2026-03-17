/**
 * MuxEngine — Core Engine Factory
 * Provides a UI-independent API for routing, executing, chatting,
 * and managing tasks between Claude Code and Codex CLI.
 *
 * All execution methods return AsyncGenerator<MuxEvent>.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeTask, routeTask, routeTaskHybrid, isCodingTask } from '../routing/classifier.js';
import { decomposeTask } from '../routing/decomposer.js';
import { getBudgetStatus } from '../budget/tracker.js';
import { getRoutingHistory } from '../routing/history.js';
import { loadConfig } from '../config/loader.js';
import { debug } from '../cli/debug.js';
import { getActiveProcesses } from '../cli/process-tracker.js';
import { streamClaude, streamChat } from './claude-stream.js';
import { streamCodex } from './codex-stream.js';
import { registerConfirm, resolveConfirm } from './confirm-registry.js';
import type { MuxEvent, RouteOptions, RouteResult } from './events.js';
import type {
  BudgetStatus,
  MuxConfig,
  RoutingLogEntry,
  DecompositionResult,
  RouteTarget,
} from '../types.js';

// ─── Version helper ──────────────────────────────────────────────────

function getPackageVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8')
    ) as { version?: string };
    return pkg.version ?? 'unknown';
  } catch (err) {
    debug('Failed to read package.json version:', err);
    return 'unknown';
  }
}

// ─── MuxEngine Interface ─────────────────────────────────────────────

export interface MuxEngine {
  /**
   * Analyze a task and return a routing decision (no side effects).
   */
  analyzeAndRoute(task: string, opts?: RouteOptions): Promise<RouteResult>;

  /**
   * Execute a task with a pre-computed routing decision, yielding MuxEvent stream.
   * The decision must come from analyzeAndRoute() first.
   * If decision.target is unset, falls back to 'claude'.
   */
  execute(task: string, decision: RouteResult): AsyncGenerator<MuxEvent>;

  /**
   * Send a chat message using the lightweight haiku model.
   */
  chat(message: string): AsyncGenerator<MuxEvent>;

  /**
   * Decompose a complex task into subtasks.
   */
  decompose(task: string): Promise<DecompositionResult>;

  /**
   * Execute a decomposed task's subtasks, yielding events for each.
   */
  executeDecomposed(result: DecompositionResult): AsyncGenerator<MuxEvent>;

  /**
   * Respond to a pending confirm event.
   * Resolves the waitForConfirm Promise with the chosen option.
   */
  respondToConfirm(id: string, response: string): void;

  /**
   * Cancel all active child processes.
   */
  cancel(): void;

  /**
   * Check if a task description is a coding task.
   */
  isCodingTask(task: string): boolean;

  /**
   * Get the current budget status.
   */
  getBudget(): Promise<BudgetStatus>;

  /**
   * Get recent routing history.
   */
  getHistory(limit?: number): Promise<RoutingLogEntry[]>;

  /**
   * Get the current configuration.
   */
  getConfig(): Promise<MuxConfig>;

  /**
   * Get the package version string.
   */
  getVersion(): string;
}

// ─── Engine Implementation ───────────────────────────────────────────

class MuxEngineImpl implements MuxEngine {
  private configOverride?: Partial<MuxConfig>;

  constructor(configOverride?: Partial<MuxConfig>) {
    this.configOverride = configOverride;
  }

  async analyzeAndRoute(task: string, opts?: RouteOptions): Promise<RouteResult> {
    if (opts?.route) {
      const signals = analyzeTask(task);
      return {
        target: opts.route,
        confidence: 1.0,
        reason: `Manual route override: ${opts.route}`,
        signals,
        escalated: false,
        matchedRule: 'manual-override',
      };
    }

    const config = await this.getConfig();
    const budgetStatus = await getBudgetStatus();

    const claudePct = 1.0 - budgetStatus.claude.usagePercent / 100;
    const codexPct = 1.0 - budgetStatus.codex.usagePercent / 100;

    if (config.routing.engine === 'hybrid') {
      return routeTaskHybrid(
        task,
        config.tier,
        claudePct,
        codexPct,
        { conservationMode: config.conservation?.codexFirstOnUncertain },
      );
    }

    const signals = analyzeTask(task);
    return routeTask(
      signals,
      config.tier,
      claudePct,
      codexPct,
      task,
      { conservationMode: config.conservation?.codexFirstOnUncertain },
    );
  }

  async *execute(task: string, decision: RouteResult): AsyncGenerator<MuxEvent> {
    yield { type: 'routing', decision };

    if (decision.target === 'claude') {
      yield* streamClaude(task);
    } else {
      yield* streamCodex(task);
    }
  }

  async *chat(message: string): AsyncGenerator<MuxEvent> {
    yield* streamChat(message);
  }

  async decompose(task: string): Promise<DecompositionResult> {
    return decomposeTask(task);
  }

  async *executeDecomposed(result: DecompositionResult): AsyncGenerator<MuxEvent> {
    if (!result.shouldDecompose || result.subtasks.length === 0) {
      yield { type: 'error', message: 'No subtasks to execute', recoverable: true };
      return;
    }

    for (const subtask of result.subtasks) {
      yield {
        type: 'progress',
        message: `Executing subtask ${subtask.id}: ${subtask.description.slice(0, 80)}`,
        elapsed: 0,
      };

      // Build a manual route decision for the subtask's recommended target
      const decision = await this.analyzeAndRoute(subtask.description, {
        route: subtask.recommendedTarget,
      });
      yield* this.execute(subtask.description, decision);
    }
  }

  respondToConfirm(id: string, response: string): void {
    const resolved = resolveConfirm(id, response);
    if (!resolved) {
      debug(`respondToConfirm: no pending confirm with id ${id}`);
    }
  }

  waitForConfirm(id: string): Promise<string> {
    return registerConfirm(id);
  }

  cancel(): void {
    const processes = getActiveProcesses();
    for (const proc of processes) {
      try {
        proc.kill('SIGTERM');
      } catch (err) {
        debug('Failed to kill process:', err);
      }
    }
  }

  isCodingTask(task: string): boolean {
    return isCodingTask(task);
  }

  async getBudget(): Promise<BudgetStatus> {
    const status = await getBudgetStatus();
    // Strip the warnings extra field to match BudgetStatus interface
    const { warnings: _warnings, ...budgetStatus } = status;
    return budgetStatus as BudgetStatus;
  }

  async getHistory(limit = 50): Promise<RoutingLogEntry[]> {
    return getRoutingHistory(limit);
  }

  async getConfig(): Promise<MuxConfig> {
    const config = await loadConfig();
    if (this.configOverride) {
      return { ...config, ...this.configOverride } as MuxConfig;
    }
    return config;
  }

  getVersion(): string {
    return getPackageVersion();
  }
}

// ─── Singleton Factory ───────────────────────────────────────────────

let _instance: MuxEngineImpl | null = null;

/**
 * Create (or return existing) MuxEngine singleton.
 * Pass configOverride to override specific config fields for testing.
 * Returns a Promise to support async initialization in React hooks.
 */
export async function createEngine(configOverride?: Partial<MuxConfig>): Promise<MuxEngine> {
  if (!_instance) {
    _instance = new MuxEngineImpl(configOverride);
  } else if (configOverride) {
    // Allow re-creating with new overrides (useful in tests)
    _instance = new MuxEngineImpl(configOverride);
  }
  return _instance;
}

/**
 * Reset the singleton (for testing).
 */
export function resetEngine(): void {
  _instance = null;
}

/**
 * Register a pending confirm and return a Promise that resolves
 * when the TUI calls engine.respondToConfirm(id, choice).
 * Re-exported from confirm-registry for use in tests.
 */
export { waitForConfirm } from './confirm-registry.js';
