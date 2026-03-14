/**
 * Environment Detector
 * Detects the current subscription tiers and available tools.
 */

import type { ClaudePlan, CodexPlan, CodexMode } from '../types.js';

/** Detected environment information */
export interface DetectedEnvironment {
  /** Whether Claude Code CLI is available */
  claudeAvailable: boolean;
  /** Detected Claude plan, if determinable */
  claudePlan?: ClaudePlan;
  /** Whether Codex CLI is available */
  codexAvailable: boolean;
  /** Detected Codex plan, if determinable */
  codexPlan?: CodexPlan;
  /** Detected Codex mode */
  codexMode?: CodexMode;
  /** Whether git is available */
  gitAvailable: boolean;
  /** Current working directory */
  cwd: string;
}

/**
 * Detect the current environment including available tools and subscription tiers.
 *
 * @returns Detected environment information
 */
export async function detectEnvironment(): Promise<DetectedEnvironment> {
  // TODO: Implement environment detection
  throw new Error('Not implemented: detectEnvironment');
}
