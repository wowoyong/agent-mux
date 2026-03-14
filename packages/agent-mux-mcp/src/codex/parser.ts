/**
 * Codex Output Parser
 * Parses stdout/stderr from Codex CLI into structured output.
 */

import type { SpawnCodexOutput } from '../types.js';

/**
 * Parse raw Codex CLI output into a structured SpawnCodexOutput.
 *
 * @param stdout - Raw stdout from the Codex process
 * @param stderr - Raw stderr from the Codex process
 * @param exitCode - Exit code of the Codex process
 * @param durationMs - Execution time in milliseconds
 * @returns Parsed and structured output
 */
export function parseCodexOutput(
  stdout: string,
  stderr: string,
  exitCode: number,
  durationMs: number
): SpawnCodexOutput {
  // TODO: Implement Codex output parsing
  throw new Error('Not implemented: parseCodexOutput');
}

/**
 * Extract the unified diff from Codex output.
 *
 * @param stdout - Raw stdout from the Codex process
 * @returns Unified diff string
 */
export function extractDiff(stdout: string): string {
  // TODO: Implement diff extraction
  throw new Error('Not implemented: extractDiff');
}

/**
 * Extract the list of modified files from a diff.
 *
 * @param diff - Unified diff string
 * @returns Array of modified file paths
 */
export function extractModifiedFiles(diff: string): string[] {
  // TODO: Implement modified file extraction
  throw new Error('Not implemented: extractModifiedFiles');
}
