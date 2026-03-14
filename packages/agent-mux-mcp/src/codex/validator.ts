/**
 * Codex Output Validator
 * Validates the quality and safety of changes produced by Codex CLI.
 * Includes file scope validation against a deny-list of sensitive patterns.
 */

import type { SpawnCodexOutput } from '../types.js';
import { DEFAULT_DENY_LIST } from '../types.js';

// ─── Validation Types ───────────────────────────────────────────────

/** Result of validating Codex output */
export interface ValidationResult {
  /** Whether the output passed all validation checks */
  valid: boolean;
  /** Whether all modified files are within the allowed scope */
  passed: boolean;
  /** Files that matched a deny pattern */
  deniedFiles: string[];
  /** List of individual issues found */
  issues: ValidationIssue[];
  /** Overall quality score 0-1 */
  qualityScore: number;
  /** Human-readable summary message */
  message?: string;
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

// ─── File Scope Validation ──────────────────────────────────────────

/**
 * Check whether any modified files match a deny-list pattern.
 * Returns a result indicating which files (if any) were denied.
 */
export function validateFileScope(
  modifiedFiles: string[],
  denyList?: string[],
): ValidationResult {
  const patterns = denyList ?? DEFAULT_DENY_LIST;
  const deniedFiles = modifiedFiles.filter((file) =>
    patterns.some((pattern) => simpleGlobMatch(file, pattern)),
  );

  const issues: ValidationIssue[] = deniedFiles.map((file) => ({
    severity: 'error' as const,
    message: `File matches deny-list pattern: ${file}`,
    file,
  }));

  const passed = deniedFiles.length === 0;

  return {
    valid: passed,
    passed,
    deniedFiles,
    issues,
    qualityScore: passed ? 1.0 : 0.0,
    message: passed
      ? undefined
      : `Codex modified restricted files: ${deniedFiles.join(', ')}`,
  };
}

// ─── Full Output Validation ─────────────────────────────────────────

/**
 * Validate the output from a Codex CLI process.
 * Checks exit code, output content, and file scope against deny patterns.
 */
export async function validateOutput(
  output: SpawnCodexOutput,
  denyPatterns?: string[],
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  let qualityScore = 1.0;

  // 1. Check exit code
  if (output.exitCode !== 0) {
    issues.push({
      severity: 'error',
      message: `Codex exited with non-zero code: ${output.exitCode}`,
    });
    qualityScore -= 0.5;
  }

  // 2. Check stderr for warnings/errors
  if (output.stderr.length > 0) {
    const stderrLower = output.stderr.toLowerCase();
    if (stderrLower.includes('error')) {
      issues.push({
        severity: 'warning',
        message: 'Codex stderr contains error messages',
      });
      qualityScore -= 0.2;
    }
  }

  // 3. Check for empty output on success
  if (output.success && output.filesModified.length === 0) {
    issues.push({
      severity: 'info',
      message: 'Codex completed successfully but produced no changes',
    });
  }

  // 4. File scope validation
  const scopeResult = validateFileScope(output.filesModified, denyPatterns);
  issues.push(...scopeResult.issues);

  if (!scopeResult.passed) {
    qualityScore -= 0.3;
  }

  qualityScore = Math.max(0, Math.min(1, qualityScore));
  const valid = !issues.some((i) => i.severity === 'error');

  return {
    valid,
    passed: scopeResult.passed,
    deniedFiles: scopeResult.deniedFiles,
    issues,
    qualityScore,
    message: valid
      ? undefined
      : issues
          .filter((i) => i.severity === 'error')
          .map((i) => i.message)
          .join('; '),
  };
}

// ─── Glob Matcher ───────────────────────────────────────────────────

/**
 * Simple glob matcher — supports *, **, and ? patterns without external dependencies.
 * Matches the basename against basename-only patterns,
 * and the full path against patterns containing '/'.
 */
export function simpleGlobMatch(filepath: string, pattern: string): boolean {
  // Normalize: strip leading ./
  const normalizedPath = filepath.replace(/^\.\//, '');
  const normalizedPattern = pattern.replace(/^\.\//, '');

  // If pattern has no directory separator, match against both basename and full path
  if (!normalizedPattern.includes('/')) {
    const basename = normalizedPath.split('/').pop() ?? normalizedPath;
    return (
      globToRegex(normalizedPattern).test(basename) ||
      globToRegex(normalizedPattern).test(normalizedPath)
    );
  }

  return globToRegex(normalizedPattern).test(normalizedPath);
}

/**
 * Convert a glob pattern to a RegExp.
 * Supports: * (any non-separator chars), ** (any chars including /), ? (single char).
 */
function globToRegex(pattern: string): RegExp {
  let regexStr = '';
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i]!;

    if (char === '*') {
      if (pattern[i + 1] === '*') {
        // ** matches anything including path separators
        regexStr += '.*';
        i += 2;
        // Skip trailing slash after **
        if (pattern[i] === '/') i++;
      } else {
        // * matches anything except /
        regexStr += '[^/]*';
        i++;
      }
    } else if (char === '?') {
      regexStr += '.';
      i++;
    } else if (char === '.') {
      regexStr += '\\.';
      i++;
    } else if (
      char === '(' ||
      char === ')' ||
      char === '[' ||
      char === ']' ||
      char === '{' ||
      char === '}' ||
      char === '+' ||
      char === '^' ||
      char === '$' ||
      char === '|' ||
      char === '\\'
    ) {
      regexStr += '\\' + char;
      i++;
    } else {
      regexStr += char;
      i++;
    }
  }

  return new RegExp(`^${regexStr}$`);
}
