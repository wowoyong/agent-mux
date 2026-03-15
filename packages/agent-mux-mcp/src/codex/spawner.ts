/**
 * Codex Spawner
 * Manages the lifecycle of Codex CLI processes including worktree creation,
 * JSONL event monitoring, stall detection, and cleanup.
 */

import { spawn as nodeSpawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SpawnCodexInput, SpawnCodexOutput } from '../types.js';
import { JsonlStreamParser } from './parser.js';
import { createWorktree, cleanupWorktree } from './worktree.js';
import { validateFileScope } from './validator.js';
import { registerProcess, unregisterProcess } from '../cli/process-tracker.js';

const execAsync = promisify(execFile);

// ─── Options ────────────────────────────────────────────────────────

export interface SpawnerOptions {
  /** Path to the codex binary (default: 'codex') */
  codexPath?: string;
  /** Stall detection threshold in ms (default: 90000) */
  stallThresholdMs?: number;
}

// ─── Task ID Generator ──────────────────────────────────────────────

function generateTaskId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// ─── Modified Files from Git ────────────────────────────────────────

async function getModifiedFiles(worktreePath: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync('git', ['diff', '--name-only', 'HEAD'], {
      cwd: worktreePath,
    });
    return stdout
      .trim()
      .split('\n')
      .filter((f) => f.length > 0);
  } catch {
    return [];
  }
}

// ─── Main Spawner ───────────────────────────────────────────────────

/**
 * Spawn a Codex CLI process with the given configuration.
 * Creates an isolated worktree, runs codex exec with --json --full-auto,
 * monitors JSONL events for stall detection, and returns structured output.
 */
export async function spawn(
  input: SpawnCodexInput,
  options?: SpawnerOptions,
): Promise<SpawnCodexOutput> {
  const startTime = Date.now();
  const taskId = generateTaskId();
  const codexPath = options?.codexPath ?? 'codex';
  const stallThresholdMs = options?.stallThresholdMs ?? 90_000;

  // ── Worktree setup ──────────────────────────────────────────────
  const worktreePath = input.worktreePath ?? `.codex-worktrees/task-${taskId}`;
  const branchName = `codex/task-${taskId}`;
  await createWorktree(worktreePath, branchName);

  // ── Build args ──────────────────────────────────────────────────
  const args = ['exec', '--full-auto', '--json', '--ephemeral'];
  args.push('-C', worktreePath);

  const resultPath = `${worktreePath}/.codex-result.txt`;
  args.push('-o', resultPath);

  args.push(input.prompt);

  // ── Spawn ───────────────────────────────────────────────────────
  const proc = nodeSpawn(codexPath, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  registerProcess(proc);

  const parser = new JsonlStreamParser();
  let stdout = '';
  let stderr = '';

  proc.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stdout += text;
    parser.feed(text);
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  // ── ENOENT handling ─────────────────────────────────────────────
  let spawnError: NodeJS.ErrnoException | null = null;
  proc.on('error', (err: NodeJS.ErrnoException) => {
    spawnError = err;
  });

  // ── Timeout ─────────────────────────────────────────────────────
  const timeoutMs = input.timeout ?? 420_000;
  const timeout = setTimeout(() => {
    proc.kill('SIGTERM');
  }, timeoutMs);

  // ── Stall detection (check every 5s) ────────────────────────────
  const stallCheck = setInterval(() => {
    if (parser.isStalled(stallThresholdMs)) {
      proc.kill('SIGTERM');
    }
  }, 5_000);

  // ── Wait for exit ───────────────────────────────────────────────
  const exitCode = await new Promise<number>((resolve) => {
    proc.on('close', (code) => {
      clearTimeout(timeout);
      clearInterval(stallCheck);
      unregisterProcess(proc);
      resolve(code ?? 1);
    });
    // If spawn itself fails (ENOENT), 'close' may not fire in all versions
    proc.on('error', () => {
      clearTimeout(timeout);
      clearInterval(stallCheck);
      unregisterProcess(proc);
      resolve(127);
    });
  });

  // ── Friendly error for missing CLI ──────────────────────────────
  const capturedError = spawnError as unknown as NodeJS.ErrnoException | null;
  if (capturedError) {
    const durationMs = Date.now() - startTime;
    const errorMsg = capturedError.code === 'ENOENT'
      ? 'Codex CLI not found. Install: npm install -g @openai/codex'
      : capturedError.message;
    return {
      success: false,
      taskId,
      worktreePath,
      branchName,
      filesModified: [],
      stdout: '',
      stderr: errorMsg,
      exitCode: 127,
      durationMs,
      deniedFiles: [],
      jsonlEvents: 0,
    };
  }

  // ── Collect results ─────────────────────────────────────────────
  const durationMs = Date.now() - startTime;
  const filesModified = await getModifiedFiles(worktreePath);

  // ── Validate file scope ─────────────────────────────────────────
  const validation = validateFileScope(filesModified, input.denyList);

  return {
    success: exitCode === 0,
    taskId,
    worktreePath,
    branchName,
    filesModified,
    stdout,
    stderr,
    exitCode,
    durationMs,
    deniedFiles: validation.deniedFiles,
    jsonlEvents: parser.getAllEvents().length,
  };
}

/**
 * Re-export worktree utilities for convenience.
 */
export { createWorktree, cleanupWorktree } from './worktree.js';
