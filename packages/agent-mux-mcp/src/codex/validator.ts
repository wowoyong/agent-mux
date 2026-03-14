/**
 * Codex Output Validator
 * Validates the quality and safety of changes produced by Codex CLI.
 */

import type { SpawnCodexOutput } from '../types.js';

/** Validation result for Codex output */
export interface ValidationResult {
  /** Whether the output passed all validation checks */
  valid: boolean;
  /** List of issues found */
  issues: ValidationIssue[];
  /** Overall quality score 0-1 */
  qualityScore: number;
}

/** A single validation issue */
export interface ValidationIssue {
  /** Severity of the issue */
  severity: 'error' | 'warning' | 'info';
  /** Human-readable message */
  message: string;
  /** File path if applicable */
  file?: string;
}

/**
 * Validate the output from a Codex CLI process.
 *
 * @param output - The Codex output to validate
 * @param denyPatterns - Optional deny-list patterns to check against
 * @returns Validation result with issues and quality score
 */
export async function validateOutput(
  output: SpawnCodexOutput,
  denyPatterns?: string[]
): Promise<ValidationResult> {
  // TODO: Implement output validation
  throw new Error('Not implemented: validateOutput');
}
