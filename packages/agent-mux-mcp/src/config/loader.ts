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
import type { MuxConfig, TierName } from '../types.js';
import { DEFAULT_DENY_LIST } from '../types.js';
import { getTierPreset } from './tiers.js';

/**
 * Minimal YAML parser for simple key-value YAML files.
 * Handles flat keys, nested objects (via indentation), arrays (via - prefix),
 * and basic types (string, number, boolean).
 * Not a full YAML parser -- sufficient for .agent-mux/config.yaml.
 */
function parseSimpleYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');
  const stack: { indent: number; obj: Record<string, unknown> }[] = [
    { indent: -1, obj: result },
  ];

  for (const rawLine of lines) {
    // Skip blank lines and comments
    if (/^\s*(#|$)/.test(rawLine)) continue;

    const indent = rawLine.search(/\S/);
    const line = rawLine.trim();

    // Pop stack to find parent at lower indent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;

    // Array item: "- value"
    if (line.startsWith('- ')) {
      // Find the last key in parent that is an array
      const keys = Object.keys(parent);
      const lastKey = keys[keys.length - 1];
      if (lastKey && Array.isArray(parent[lastKey])) {
        (parent[lastKey] as unknown[]).push(parseYamlValue(line.slice(2).trim()));
      }
      continue;
    }

    // Key: value
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const rawValue = line.slice(colonIndex + 1).trim();

    if (rawValue === '' || rawValue === '|' || rawValue === '>') {
      // Nested object or block scalar -- create nested object
      const nested: Record<string, unknown> = {};
      parent[key] = nested;
      stack.push({ indent, obj: nested });
    } else if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      // Inline array: [a, b, c]
      const items = rawValue.slice(1, -1).split(',').map((s) => parseYamlValue(s.trim()));
      parent[key] = items;
    } else {
      parent[key] = parseYamlValue(rawValue);
    }
  }

  return result;
}

function parseYamlValue(raw: string): string | number | boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null' || raw === '~') return '' as unknown as string;
  // Remove quotes
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  const num = Number(raw);
  if (!isNaN(num) && raw !== '') return num;
  return raw;
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

  for (const configPath of searchPaths) {
    if (existsSync(configPath)) {
      try {
        const content = await readFile(configPath, 'utf-8');
        const parsed = parseSimpleYaml(content);
        return mergeWithDefaults(parsed);
      } catch {
        // Fall through to next path
      }
    }
  }

  // No config file found -- return defaults
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
