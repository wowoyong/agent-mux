/**
 * Configuration Loader
 * Loads and validates mux configuration from YAML files.
 *
 * Search paths (in order):
 *   1. <projectRoot>/.agent-mux/config.yaml
 *   2. ~/.agent-mux/config.yaml
 *   3. Default config for 'standard' tier
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import YAML from 'yaml';
import type { MuxConfig, TierName } from '../types.js';
import { DEFAULT_DENY_LIST } from '../types.js';
import { getTierPreset } from './tiers.js';
import { debug } from '../cli/debug.js';

/**
 * Parse YAML content into a plain object.
 * Uses the `yaml` package for full YAML spec support
 * (multi-line strings, anchors, aliases, null values, etc.).
 */
function parseYaml(content: string): Record<string, unknown> {
  return (YAML.parse(content) ?? {}) as Record<string, unknown>;
}

/**
 * Load the mux configuration.
 * Searches config paths in order, falls back to defaults.
 *
 * @param projectRoot - Project root directory to search from
 * @returns Parsed and validated configuration
 */
export async function loadConfig(projectRoot?: string): Promise<MuxConfig> {
  const searchPaths: string[] = [];

  if (projectRoot) {
    searchPaths.push(join(projectRoot, '.agent-mux', 'config.yaml'));
  }

  // Current directory fallback
  searchPaths.push(join(process.cwd(), '.agent-mux', 'config.yaml'));

  // Home directory fallback
  searchPaths.push(join(homedir(), '.agent-mux', 'config.yaml'));

  debug('Config search paths:', searchPaths);

  for (const configPath of searchPaths) {
    if (existsSync(configPath)) {
      try {
        debug(`Loading config from: ${configPath}`);
        const content = await readFile(configPath, 'utf-8');
        const parsed = parseYaml(content);
        return mergeWithDefaults(parsed);
      } catch {
        debug(`Failed to load config from: ${configPath}`);
        // Fall through to next path
      }
    }
  }

  // No config file found -- return defaults
  debug('No config file found, using defaults');
  return getDefaultConfig('standard');
}

/**
 * Get the default configuration for a given tier.
 *
 * @param tier - The tier name
 * @returns Full default configuration
 */
export function getDefaultConfig(tier: TierName): MuxConfig {
  const preset = getTierPreset(tier);

  return {
    schemaVersion: 1,
    tier,
    claude: preset.claude ?? { plan: 'pro', cost: 20 },
    codex: preset.codex ?? { plan: 'plus', cost: 20, mode: 'local' },
    routing: preset.routing ?? {
      engine: 'local',
      bias: 'balanced',
      split: { claude: 50, codex: 50 },
      escalation: { enabled: true, strategy: 'fix', maxRetries: 1 },
    },
    budget: {
      warnings: [50, 80, 95],
    },
    denyList: [...DEFAULT_DENY_LIST],
  };
}

/**
 * Merge parsed YAML config with default values.
 */
function mergeWithDefaults(parsed: Record<string, unknown>): MuxConfig {
  const tierName = (parsed['tier'] as TierName) ?? 'standard';
  const defaults = getDefaultConfig(tierName);

  const claude = parsed['claude'] as Record<string, unknown> | undefined;
  const codex = parsed['codex'] as Record<string, unknown> | undefined;
  const routing = parsed['routing'] as Record<string, unknown> | undefined;
  const budget = parsed['budget'] as Record<string, unknown> | undefined;

  return {
    schemaVersion: (parsed['schemaVersion'] as number) ?? defaults.schemaVersion,
    tier: tierName,
    claude: {
      plan: (claude?.['plan'] as MuxConfig['claude']['plan']) ?? defaults.claude.plan,
      cost: (claude?.['cost'] as number) ?? defaults.claude.cost,
    },
    codex: {
      plan: (codex?.['plan'] as MuxConfig['codex']['plan']) ?? defaults.codex.plan,
      cost: (codex?.['cost'] as number) ?? defaults.codex.cost,
      mode: (codex?.['mode'] as MuxConfig['codex']['mode']) ?? defaults.codex.mode,
    },
    routing: {
      engine: ((routing?.['engine'] as string) ?? defaults.routing.engine) as MuxConfig['routing']['engine'],
      bias: ((routing?.['bias'] as string) ?? defaults.routing.bias) as MuxConfig['routing']['bias'],
      split: {
        claude: ((routing?.['split'] as Record<string, unknown>)?.['claude'] as number) ?? defaults.routing.split.claude,
        codex: ((routing?.['split'] as Record<string, unknown>)?.['codex'] as number) ?? defaults.routing.split.codex,
      },
      escalation: {
        enabled: ((routing?.['escalation'] as Record<string, unknown>)?.['enabled'] as boolean) ?? defaults.routing.escalation.enabled,
        strategy: (((routing?.['escalation'] as Record<string, unknown>)?.['strategy'] as string) ?? defaults.routing.escalation.strategy) as MuxConfig['routing']['escalation']['strategy'],
        maxRetries: ((routing?.['escalation'] as Record<string, unknown>)?.['maxRetries'] as number) ?? defaults.routing.escalation.maxRetries,
      },
    },
    budget: {
      warnings: (budget?.['warnings'] as number[]) ?? defaults.budget.warnings,
    },
    denyList: (parsed['denyList'] as string[]) ?? defaults.denyList,
  };
}

/**
 * Save the mux configuration to a YAML file.
 *
 * @param config - The configuration to save
 * @param configPath - Path to write the config file
 */
export async function saveConfig(config: MuxConfig, configPath?: string): Promise<void> {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');

  const targetPath = configPath ?? join(process.cwd(), '.agent-mux', 'config.yaml');
  await mkdir(dirname(targetPath), { recursive: true });

  const yaml = configToYaml(config);
  await writeFile(targetPath, yaml, 'utf-8');
}

/**
 * Serialize config to simple YAML format.
 */
function configToYaml(config: MuxConfig): string {
  const lines: string[] = [
    `# agent-mux configuration`,
    `schemaVersion: ${config.schemaVersion}`,
    `tier: ${config.tier}`,
    ``,
    `claude:`,
    `  plan: ${config.claude.plan}`,
    `  cost: ${config.claude.cost}`,
    ``,
    `codex:`,
    `  plan: ${config.codex.plan}`,
    `  cost: ${config.codex.cost}`,
    `  mode: ${config.codex.mode}`,
    ``,
    `routing:`,
    `  engine: ${config.routing.engine}`,
    `  bias: ${config.routing.bias}`,
    `  split:`,
    `    claude: ${config.routing.split.claude}`,
    `    codex: ${config.routing.split.codex}`,
    `  escalation:`,
    `    enabled: ${config.routing.escalation.enabled}`,
    `    strategy: ${config.routing.escalation.strategy}`,
    `    maxRetries: ${config.routing.escalation.maxRetries}`,
    ``,
    `budget:`,
    `  warnings: [${config.budget.warnings.join(', ')}]`,
  ];

  if (config.denyList && config.denyList.length > 0) {
    lines.push('');
    lines.push('denyList:');
    for (const pattern of config.denyList) {
      lines.push(`  - ${pattern}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Find the nearest config file by searching known paths.
 *
 * @param startDir - Directory to start searching from
 * @returns Path to the config file, or null if not found
 */
export async function findConfig(startDir?: string): Promise<string | null> {
  const searchPaths: string[] = [];

  if (startDir) {
    searchPaths.push(join(startDir, '.agent-mux', 'config.yaml'));
  }

  searchPaths.push(join(process.cwd(), '.agent-mux', 'config.yaml'));
  searchPaths.push(join(homedir(), '.agent-mux', 'config.yaml'));

  for (const p of searchPaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return null;
}
