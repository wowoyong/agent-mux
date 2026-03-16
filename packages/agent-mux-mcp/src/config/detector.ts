/**
 * Environment Detector
 * Detects the current subscription tiers, available tools, and sibling plugins.
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { promisify } from 'node:util';
import type { ClaudePlan, CodexPlan, CodexMode } from '../types.js';
import type { DetectedPlugin } from '../types.js';
import { debug } from '../cli/debug.js';

const execFileAsync = promisify(execFile);

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

/** Sibling plugin names to look for */
const SIBLING_PLUGINS = [
  'harness-planner',
  'architecture-enforcer',
  'harness-docs',
] as const;

/**
 * Detect the current environment including available tools and subscription tiers.
 *
 * @returns Detected environment information
 */
export async function detectEnvironment(): Promise<DetectedEnvironment> {
  const [claudeResult, codexResult, gitResult] = await Promise.allSettled([
    execFileAsync('claude', ['--version'], { timeout: 5000 }),
    execFileAsync('codex', ['--version'], { timeout: 5000 }),
    execFileAsync('git', ['--version'], { timeout: 5000 }),
  ]);

  return {
    claudeAvailable: claudeResult.status === 'fulfilled',
    codexAvailable: codexResult.status === 'fulfilled',
    gitAvailable: gitResult.status === 'fulfilled',
    cwd: process.cwd(),
  };
}

/**
 * Detect the Codex CLI installation details.
 *
 * @returns Object with installed status, version, and path
 */
export async function detectCodexCli(): Promise<{
  installed: boolean;
  version?: string;
  path?: string;
}> {
  try {
    const { stdout } = await execFileAsync('which', ['codex'], { timeout: 5000 });
    const codexPath = stdout.trim();

    let version: string | undefined;
    try {
      const { stdout: versionOut } = await execFileAsync('codex', ['--version'], { timeout: 5000 });
      version = versionOut.trim();
    } catch (err) {
      debug('Codex version detection failed:', err);
    }

    return {
      installed: true,
      version,
      path: codexPath,
    };
  } catch (err) {
    debug('Codex CLI detection failed:', err);
    return { installed: false };
  }
}

/**
 * Detect sibling plugins in the Claude plugins cache.
 * Checks for: harness-planner, architecture-enforcer, harness-docs
 * in ~/.claude/plugins/cache/wowoyong/
 *
 * @returns Array of detected plugins with availability info
 */
export async function detectSiblingPlugins(): Promise<DetectedPlugin[]> {
  const pluginCacheDir = join(homedir(), '.claude', 'plugins', 'cache', 'wowoyong');
  const results: DetectedPlugin[] = [];

  for (const pluginName of SIBLING_PLUGINS) {
    const pluginPath = join(pluginCacheDir, pluginName);
    const available = existsSync(pluginPath);

    results.push({
      name: pluginName,
      path: pluginPath,
      available,
    });
  }

  return results;
}
