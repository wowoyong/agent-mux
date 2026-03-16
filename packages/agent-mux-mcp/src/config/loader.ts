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
      } catch (err) {
        debug(`Failed to load config from: ${configPath}`, err);
        // Fall through to next path
      }
    }
  }

  // No config file found -- return defaults
  debug('No config file found, using defaults');
  return getDefaultConfig('standard');
}

const VALID_TIERS = new Set(['budget', 'standard', 'premium', 'power']);
const VALID_CLAUDE_PLANS = new Set(['pro', 'max_5x', 'max_20x']);
const VALID_CODEX_PLANS = new Set(['plus', 'pro']);
const VALID_CODEX_MODES = new Set(['local', 'cloud_and_local']);
const VALID_ENGINES = new Set(['local', 'hybrid']);
const VALID_BIASES = new Set(['codex', 'balanced', 'claude', 'adaptive']);
const VALID_STRATEGIES = new Set(['fix', 'fix_then_redo', 'full']);

function validateEnum<T extends string>(value: unknown, valid: Set<string>, fallback: T, label: string): T {
  if (typeof value === 'string' && valid.has(value)) return value as T;
  if (value !== undefined) debug(`Invalid ${label}: "${value}", using default "${fallback}"`);
  return fallback;
}

function validateNumber(value: unknown, min: number, max: number, fallback: number, label: string): number {
  if (typeof value === 'number' && value >= min && value <= max) return value;
  if (value !== undefined && value !== null) debug(`Invalid ${label}: ${value}, using default ${fallback}`);
  return fallback;
}

/**
 * Validate config and return warnings for invalid values.
 */
export function validateConfig(config: MuxConfig): string[] {
  const errors: string[] = [];
  if (!VALID_TIERS.has(config.tier)) errors.push(`Invalid tier "${config.tier}". Valid: ${[...VALID_TIERS].join(', ')}`);
  if (!VALID_ENGINES.has(config.routing.engine)) errors.push(`Invalid routing.engine "${config.routing.engine}"`);
  if (!VALID_BIASES.has(config.routing.bias)) errors.push(`Invalid routing.bias "${config.routing.bias}"`);
  if (config.routing.split.claude + config.routing.split.codex !== 100) errors.push(`routing.split must sum to 100`);
  if (config.claude.cost < 0 || config.codex.cost < 0) errors.push('Cost values cannot be negative');
  return errors;
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
 * Validates all fields and falls back to defaults for invalid values.
 */
function mergeWithDefaults(parsed: Record<string, unknown>): MuxConfig {
  const tierName = validateEnum(parsed['tier'], VALID_TIERS, 'standard' as TierName, 'tier');
  const defaults = getDefaultConfig(tierName);

  const claude = parsed['claude'] as Record<string, unknown> | undefined;
  const codex = parsed['codex'] as Record<string, unknown> | undefined;
  const routing = parsed['routing'] as Record<string, unknown> | undefined;
  const budget = parsed['budget'] as Record<string, unknown> | undefined;

  const splitClaude = validateNumber(
    (routing?.['split'] as Record<string, unknown>)?.['claude'],
    0, 100, defaults.routing.split.claude, 'routing.split.claude'
  );
  const splitCodex = validateNumber(
    (routing?.['split'] as Record<string, unknown>)?.['codex'],
    0, 100, defaults.routing.split.codex, 'routing.split.codex'
  );
  if (splitClaude + splitCodex !== 100) {
    debug(`Warning: routing.split sums to ${splitClaude + splitCodex}, expected 100`);
  }

  let warnings = defaults.budget.warnings;
  if (budget?.['warnings'] && Array.isArray(budget['warnings'])) {
    const valid = (budget['warnings'] as unknown[]).filter(
      (v): v is number => typeof v === 'number' && v >= 0 && v <= 100
    );
    if (valid.length > 0) warnings = valid;
  }

  return {
    schemaVersion: validateNumber(parsed['schemaVersion'] as number, 1, 99, defaults.schemaVersion, 'schemaVersion'),
    tier: tierName,
    claude: {
      plan: validateEnum(claude?.['plan'], VALID_CLAUDE_PLANS, defaults.claude.plan, 'claude.plan'),
      cost: validateNumber(claude?.['cost'], 0, 10000, defaults.claude.cost, 'claude.cost'),
    },
    codex: {
      plan: validateEnum(codex?.['plan'], VALID_CODEX_PLANS, defaults.codex.plan, 'codex.plan'),
      cost: validateNumber(codex?.['cost'], 0, 10000, defaults.codex.cost, 'codex.cost'),
      mode: validateEnum(codex?.['mode'], VALID_CODEX_MODES, defaults.codex.mode, 'codex.mode'),
    },
    routing: {
      engine: validateEnum(routing?.['engine'], VALID_ENGINES, defaults.routing.engine, 'routing.engine'),
      bias: validateEnum(routing?.['bias'], VALID_BIASES, defaults.routing.bias, 'routing.bias'),
      split: { claude: splitClaude, codex: splitCodex },
      escalation: {
        enabled: ((routing?.['escalation'] as Record<string, unknown>)?.['enabled'] as boolean) ?? defaults.routing.escalation.enabled,
        strategy: validateEnum(
          (routing?.['escalation'] as Record<string, unknown>)?.['strategy'],
          VALID_STRATEGIES, defaults.routing.escalation.strategy, 'routing.escalation.strategy'
        ),
        maxRetries: validateNumber(
          (routing?.['escalation'] as Record<string, unknown>)?.['maxRetries'],
          0, 10, defaults.routing.escalation.maxRetries, 'routing.escalation.maxRetries'
        ),
      },
    },
    budget: { warnings },
    conservation: parseConservation(parsed['conservation'] as Record<string, unknown> | undefined),
    team: parseTeam(parsed['team'] as Record<string, unknown> | undefined),
    denyList: (parsed['denyList'] as string[]) ?? defaults.denyList,
  };
}

function parseConservation(raw: Record<string, unknown> | undefined): MuxConfig['conservation'] {
  if (!raw) return undefined;
  return {
    codexFirstOnUncertain: raw['codex_first_on_uncertain'] === true || raw['codexFirstOnUncertain'] === true,
  };
}

function parseTeam(raw: Record<string, unknown> | undefined): MuxConfig['team'] {
  if (!raw || typeof raw['sharedDir'] !== 'string') return undefined;
  return {
    sharedDir: raw['sharedDir'] as string,
    userId: typeof raw['userId'] === 'string' ? raw['userId'] : undefined,
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

  if (config.conservation) {
    lines.push('');
    lines.push('conservation:');
    if (config.conservation.codexFirstOnUncertain !== undefined) {
      lines.push(`  codex_first_on_uncertain: ${config.conservation.codexFirstOnUncertain}`);
    }
  }

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
