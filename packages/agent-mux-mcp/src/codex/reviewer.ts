/**
 * Codex Reviewer
 * Automated verification that runs in the Codex worktree after task completion.
 * Supports multiple verification strategies: tests, lint, diff-review, or none.
 *
 * Note: This module uses Node.js execFile (not exec) for subprocess execution,
 * which is safe against shell injection as arguments are passed as arrays.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReviewResult, VerifyStrategy } from '../types.js';

const execFileAsync = promisify(execFile);

export async function runPostSpawnReview(
  worktreePath: string,
  verifyStrategy: VerifyStrategy,
): Promise<ReviewResult> {
  const result: ReviewResult = {
    passed: true,
    strategy: verifyStrategy,
    testsRan: false,
    testsPassed: false,
    typecheckPassed: false,
    lintPassed: false,
    diffSummary: '',
    issues: [],
    stdout: '',
    stderr: '',
  };

  if (verifyStrategy === 'none') return result;

  // Always get diff summary
  result.diffSummary = await getDiffSummary(worktreePath);

  if (verifyStrategy === 'tests' || verifyStrategy === 'lint') {
    // Run typecheck if tsconfig exists
    if (await fileExists(join(worktreePath, 'tsconfig.json'))) {
      const typecheck = await runCommand(worktreePath, 'npx', ['tsc', '--noEmit']);
      result.typecheckPassed = typecheck.exitCode === 0;
      if (typecheck.exitCode !== 0) {
        result.passed = false;
        result.issues.push(`Typecheck failed: ${typecheck.stderr.slice(0, 300)}`);
      }
      result.stdout += typecheck.stdout;
      result.stderr += typecheck.stderr;
    } else {
      result.typecheckPassed = true; // skip if no tsconfig
    }
  }

  if (verifyStrategy === 'tests') {
    // Detect and run test runner
    const testResult = await runTests(worktreePath);
    result.testsRan = testResult.ran;
    result.testsPassed = testResult.passed;
    if (testResult.ran && !testResult.passed) {
      result.passed = false;
      result.issues.push(`Tests failed: ${testResult.output.slice(0, 300)}`);
    }
    result.stdout += testResult.output;
  }

  if (verifyStrategy === 'lint') {
    // Try to run lint
    const lintResult = await runLint(worktreePath);
    result.lintPassed = lintResult.passed;
    if (!lintResult.passed) {
      result.passed = false;
      result.issues.push(`Lint failed: ${lintResult.output.slice(0, 300)}`);
    }
  }

  if (verifyStrategy === 'diff-review') {
    // For diff-review, we just provide the diff summary
    // The codex-reviewer.md agent prompt handles the actual review via Claude
    result.passed = true; // diff-review doesn't auto-fail
  }

  return result;
}

async function getDiffSummary(worktreePath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['diff', '--stat', 'HEAD~1..HEAD'], {
      cwd: worktreePath,
    });
    return stdout;
  } catch {
    // May fail if no commits yet
    try {
      const { stdout } = await execFileAsync('git', ['diff', '--stat'], {
        cwd: worktreePath,
      });
      return stdout;
    } catch {
      return '(unable to generate diff summary)';
    }
  }
}

async function runTests(
  worktreePath: string,
): Promise<{ ran: boolean; passed: boolean; output: string }> {
  // Try common test runners in order
  const runners = [
    { check: 'package.json', cmd: 'npm', args: ['test', '--', '--passWithNoTests'] },
    { check: 'pytest.ini', cmd: 'pytest', args: [] as string[] },
    { check: 'Makefile', cmd: 'make', args: ['test'] },
  ];

  for (const runner of runners) {
    if (await fileExists(join(worktreePath, runner.check))) {
      try {
        const cmdResult = await runCommand(worktreePath, runner.cmd, runner.args);
        return {
          ran: true,
          passed: cmdResult.exitCode === 0,
          output: cmdResult.stdout + cmdResult.stderr,
        };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return { ran: true, passed: false, output: message };
      }
    }
  }

  return { ran: false, passed: true, output: 'No test runner detected' };
}

async function runLint(
  worktreePath: string,
): Promise<{ passed: boolean; output: string }> {
  // Try eslint or the project's lint command
  try {
    const cmdResult = await runCommand(worktreePath, 'npm', [
      'run',
      'lint',
      '--if-present',
    ]);
    return { passed: cmdResult.exitCode === 0, output: cmdResult.stdout + cmdResult.stderr };
  } catch {
    return { passed: true, output: 'No lint command found' };
  }
}

async function runCommand(
  cwd: string,
  cmd: string,
  args: string[],
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd,
      timeout: 60_000,
    });
    return { exitCode: 0, stdout, stderr };
  } catch (e: unknown) {
    const err = e as { code?: number; stdout?: string; stderr?: string; message?: string };
    return {
      exitCode: err.code ?? 1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? err.message ?? '',
    };
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
