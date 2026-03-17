/**
 * Codex CLI Streaming Adapter
 * Wraps spawnWithRetry() and yields MuxEvent objects.
 * After completion, if files were modified, generates diff via `git diff HEAD`
 * in the worktree and yields `diff` + `confirm` events.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { spawnWithRetry } from '../codex/retry.js';
import { appendUsageRecord } from '../budget/persistence.js';
import { debug } from '../cli/debug.js';
import { CODEX_TIMEOUT_MEDIUM } from '../constants.js';
import type { SpawnCodexInput, JsonlEvent } from '../types.js';
import type { MuxEvent } from './events.js';

const execFileAsync = promisify(execFile);

// ─── Codex JSONL Event Parser ────────────────────────────────────────

/**
 * Map a single Codex JSONL event to a MuxEvent (or null to skip).
 */
export function parseCodexEvent(event: JsonlEvent): MuxEvent | null {
  switch (event.type) {
    case 'thread.started':
      return { type: 'progress', message: 'Codex started', elapsed: 0 };

    case 'turn.started':
      return { type: 'progress', message: 'Codex turn started', elapsed: 0 };

    case 'item.started': {
      if (event.item?.type === 'message' && event.item.content) {
        return { type: 'stream', chunk: event.item.content };
      }
      return null;
    }

    case 'item.completed': {
      if (event.item?.type === 'message' && event.item.content) {
        return { type: 'stream', chunk: event.item.content };
      }
      if (event.item?.type === 'tool_call' && event.item.content) {
        return { type: 'tool_use', tool: 'codex_tool', input: { content: event.item.content } };
      }
      return null;
    }

    case 'turn.completed':
      return { type: 'progress', message: 'Codex turn completed', elapsed: 0 };

    default:
      return null;
  }
}

// ─── Git Diff Helpers ────────────────────────────────────────────────

async function getGitDiff(worktreePath: string): Promise<{ patch: string; files: string[]; additions: number; deletions: number }> {
  try {
    const { stdout: diffOutput } = await execFileAsync('git', ['diff', 'HEAD'], {
      cwd: worktreePath,
      maxBuffer: 2 * 1024 * 1024, // 2MB
    });

    const { stdout: statOutput } = await execFileAsync('git', ['diff', '--stat', 'HEAD'], {
      cwd: worktreePath,
    });

    // Parse file list from stat output
    const files: string[] = [];
    const statLines = statOutput.split('\n');
    for (const line of statLines) {
      const match = line.match(/^\s*(.+?)\s*\|/);
      if (match) {
        files.push(match[1].trim());
      }
    }

    // Count additions and deletions from stat summary line
    let additions = 0;
    let deletions = 0;
    const summaryLine = statLines.find(l => /\d+ insertion/.test(l) || /\d+ deletion/.test(l));
    if (summaryLine) {
      const addMatch = summaryLine.match(/(\d+) insertion/);
      const delMatch = summaryLine.match(/(\d+) deletion/);
      if (addMatch) additions = parseInt(addMatch[1], 10);
      if (delMatch) deletions = parseInt(delMatch[1], 10);
    }

    return { patch: diffOutput, files, additions, deletions };
  } catch (err) {
    debug('getGitDiff failed:', err);
    return { patch: '', files: [], additions: 0, deletions: 0 };
  }
}

// ─── Stream Codex ────────────────────────────────────────────────────

export interface StreamCodexOptions {
  timeout?: number;
  worktreePath?: string;
  complexity?: 'low' | 'medium' | 'high';
  contextFiles?: string[];
  verifyStrategy?: 'tests' | 'lint' | 'diff-review' | 'none';
  denyList?: string[];
}

/**
 * Run a task via Codex (with retry/escalation) and yield MuxEvent objects.
 * After completion, if files were modified, generates diff and yields
 * diff + confirm events.
 */
export async function* streamCodex(
  task: string,
  opts?: StreamCodexOptions,
): AsyncGenerator<MuxEvent> {
  const startedAt = Date.now();

  yield { type: 'progress', message: 'Routing to Codex…', elapsed: 0 };

  const input: SpawnCodexInput = {
    prompt: task,
    worktreePath: opts?.worktreePath,
    timeout: opts?.timeout ?? CODEX_TIMEOUT_MEDIUM,
    complexity: opts?.complexity,
    contextFiles: opts?.contextFiles,
    verifyStrategy: opts?.verifyStrategy,
    denyList: opts?.denyList,
  };

  let result;
  try {
    result = await spawnWithRetry(input, {
      onProgress: (event: string) => {
        debug('Codex progress:', event);
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    yield { type: 'error', message: `Codex spawn failed: ${message}`, recoverable: false };
    return;
  }

  const elapsed = Date.now() - startedAt;
  const { finalResult } = result;

  // Yield file list if files were modified
  if (finalResult.filesModified.length > 0) {
    yield {
      type: 'file_list',
      files: finalResult.filesModified,
      additions: 0,
      deletions: 0,
    };

    // Generate diff from git
    const diffData = await getGitDiff(finalResult.worktreePath);
    if (diffData.patch) {
      yield {
        type: 'diff',
        patch: diffData.patch,
        files: diffData.files.length > 0 ? diffData.files : finalResult.filesModified,
      };

      // Update file_list with actual additions/deletions
      if (diffData.additions > 0 || diffData.deletions > 0) {
        yield {
          type: 'file_list',
          files: diffData.files.length > 0 ? diffData.files : finalResult.filesModified,
          additions: diffData.additions,
          deletions: diffData.deletions,
        };
      }

      // Yield confirm event for user review
      yield {
        type: 'confirm',
        id: `codex-${finalResult.taskId}`,
        prompt: `Codex modified ${finalResult.filesModified.length} file(s) on branch ${finalResult.branchName}. Apply changes?`,
        options: ['yes', 'no', 'review'],
      };
    }
  }

  // Record usage for budget tracking
  try {
    await appendUsageRecord({
      timestamp: Date.now(),
      agent: 'codex',
      taskId: finalResult.taskId,
      success: finalResult.success,
    });
  } catch (err) {
    debug('Failed to append usage record:', err);
  }

  if (!finalResult.success) {
    const errorMsg = result.escalatedToClaude
      ? `Codex escalated to Claude after ${result.retryCount} attempts. ${result.escalationReason ?? ''}`
      : `Codex failed after ${result.retryCount} attempt(s): ${finalResult.stderr.slice(0, 200)}`;
    yield { type: 'error', message: errorMsg, recoverable: result.escalatedToClaude };
    return;
  }

  const summary = finalResult.filesModified.length > 0
    ? `Codex completed in ${Math.round(elapsed / 1000)}s. Modified: ${finalResult.filesModified.join(', ')}`
    : `Codex completed in ${Math.round(elapsed / 1000)}s. No files modified.`;

  yield { type: 'done', summary };
}
