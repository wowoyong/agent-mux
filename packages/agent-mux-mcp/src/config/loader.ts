/**
 * Configuration Loader
 * Loads and validates .mux-config.yaml from the project root.
 */

import type { MuxConfig } from '../types.js';

/**
 * Load the mux configuration from a YAML file.
 *
 * @param configPath - Path to the .mux-config.yaml file
 * @returns Parsed and validated configuration
 */
export async function loadConfig(configPath?: string): Promise<MuxConfig> {
  // TODO: Implement YAML config loading
  throw new Error('Not implemented: loadConfig');
}

/**
 * Save the mux configuration to a YAML file.
 *
 * @param config - The configuration to save
 * @param configPath - Path to write the .mux-config.yaml file
 */
export async function saveConfig(config: MuxConfig, configPath?: string): Promise<void> {
  // TODO: Implement YAML config saving
  throw new Error('Not implemented: saveConfig');
}

/**
 * Find the nearest .mux-config.yaml by walking up the directory tree.
 *
 * @param startDir - Directory to start searching from
 * @returns Path to the config file, or null if not found
 */
export async function findConfig(startDir?: string): Promise<string | null> {
  // TODO: Implement config file discovery
  throw new Error('Not implemented: findConfig');
}
