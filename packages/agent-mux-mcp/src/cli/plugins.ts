/**
 * Plugin Ecosystem
 * Detects and loads sibling plugins that enhance agent-mux routing and execution.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { debug } from './debug.js';
import type { DetectedPlugin } from '../types.js';

/** Known plugin identifiers and their npm package names */
const KNOWN_PLUGINS: Array<{ name: string; packageName: string; description: string }> = [
  {
    name: 'harness-planner',
    packageName: 'claude-plugin-harness-planner',
    description: 'Task decomposition for complex workflows',
  },
  {
    name: 'architecture-enforcer',
    packageName: 'claude-plugin-architecture-enforcer',
    description: 'Architecture rules injection for Codex spawns',
  },
  {
    name: 'harness-docs',
    packageName: 'claude-plugin-harness-docs',
    description: 'AGENTS.md-based project context for routing accuracy',
  },
];

/**
 * Detect installed plugins by checking node_modules and common paths.
 */
export function detectPlugins(): DetectedPlugin[] {
  const detected: DetectedPlugin[] = [];

  for (const plugin of KNOWN_PLUGINS) {
    const paths = [
      // Global npm
      join(process.env.HOME || '', 'node_modules', plugin.packageName),
      // Local node_modules
      join(process.cwd(), 'node_modules', plugin.packageName),
      // Claude Code plugin directory
      join(process.env.HOME || '', '.claude', 'plugins', plugin.name),
    ];

    let found = false;
    let foundPath = '';
    for (const p of paths) {
      if (existsSync(p)) {
        found = true;
        foundPath = p;
        break;
      }
    }

    detected.push({
      name: plugin.name,
      path: foundPath,
      available: found,
    });

    if (found) {
      debug(`Plugin detected: ${plugin.name} at ${foundPath}`);
    }
  }

  return detected;
}

/**
 * Get context from harness-docs plugin if available.
 * Returns project context string or null.
 */
export async function getPluginContext(): Promise<string | null> {
  // Check for AGENTS.md in project root (harness-docs compatible)
  const agentsPath = join(process.cwd(), 'AGENTS.md');
  if (existsSync(agentsPath)) {
    try {
      const { readFile } = await import('node:fs/promises');
      const content = await readFile(agentsPath, 'utf-8');
      debug(`Loaded AGENTS.md context (${content.length} chars)`);
      return content.slice(0, 2000); // Limit context size
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Format detected plugins for display.
 */
export function formatPluginStatus(plugins: DetectedPlugin[]): string[] {
  return plugins.map(p =>
    `  ${p.available ? '\u2713' : '\u2717'} ${p.name}${p.available ? '' : ' (not installed)'}`
  );
}
