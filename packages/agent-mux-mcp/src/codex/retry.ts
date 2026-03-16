/**
 * Codex Retry Chain
 * Implements retry logic with escalation for failed Codex tasks.
 * On each retry, denied files are accumulated and error context is appended.
 * After exhausting retries, escalates to Claude for manual handling.
 */

import { spawn } from './spawner.js';
import { validateFileScope } from './validator.js';
import { runPostSpawnReview } from './reviewer.js';
import { loadConfig } from '../config/loader.js';
import type { SpawnCodexInput, SpawnCodexOutput, EscalationResult, EscalationStrategy } from '../types.js';

export interface RetryOptions {
  codexPath?: string;
  stallThresholdMs?: number;
  /** Callback for progress updates based on JSONL events */
  onProgress?: (event: string) => void;
}

export async function spawnWithRetry(
  input: SpawnCodexInput,
  options?: RetryOptions
): Promise<EscalationResult> {
  const config = await loadConfig();
  const maxRetries = config.routing.escalation.maxRetries;
  const strategy = config.routing.escalation.strategy;

  const retryHistory: EscalationResult['retryHistory'] = [];
  let lastResult: SpawnCodexOutput | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Build prompt with retry context
    const prompt = attempt === 0
      ? input.prompt
      : buildRetryPrompt(input.prompt, retryHistory);

    // Accumulate deny list from previous attempts
    const denyList = [
      ...(input.denyList ?? []),
      ...retryHistory.flatMap(h => h.deniedFiles),
    ];

    const retryInput: SpawnCodexInput = {
      ...input,
      prompt,
      denyList: [...new Set(denyList)], // deduplicate
    };

    lastResult = await spawn(retryInput, options);

    // Run file scope validation
    const validation = validateFileScope(lastResult.filesModified, retryInput.denyList);
    lastResult.deniedFiles = validation.deniedFiles;
    if (!validation.passed) {
      lastResult.success = false;
    }

    // Run post-spawn review if verification strategy is set
    if (lastResult.success && input.verifyStrategy && input.verifyStrategy !== 'none') {
      const review = await runPostSpawnReview(lastResult.worktreePath, input.verifyStrategy);
      if (!review.passed) {
        lastResult.success = false;
        // Add review issues to stderr for retry context
        const reviewErrors = review.issues.join('; ');
        lastResult.stderr += `\n[reviewer] ${reviewErrors}`;
      }
    }

    if (lastResult.success) {
      return {
        finalResult: lastResult,
        retryCount: attempt,
        escalatedToClaude: false,
        retryHistory,
      };
    }

    // Record failure
    retryHistory.push({
      attempt,
      exitCode: lastResult.exitCode,
      error: lastResult.stderr.slice(0, 500),
      deniedFiles: lastResult.deniedFiles,
    });
  }

  // All retries exhausted — escalate to Claude
  return {
    finalResult: lastResult!,
    retryCount: maxRetries + 1,
    escalatedToClaude: true,
    escalationReason: buildEscalationReason(retryHistory, strategy),
    retryHistory,
  };
}

function buildRetryPrompt(originalPrompt: string, history: EscalationResult['retryHistory']): string {
  const lastFailure = history[history.length - 1];
  let retryPrompt = originalPrompt;

  retryPrompt += '\n\n--- RETRY CONTEXT ---';
  retryPrompt += `\nPrevious attempt failed (attempt ${lastFailure.attempt + 1}).`;

  if (lastFailure.error) {
    retryPrompt += `\nError: ${lastFailure.error}`;
  }

  if (lastFailure.deniedFiles.length > 0) {
    retryPrompt += `\nDo NOT modify these files: ${lastFailure.deniedFiles.join(', ')}`;
  }

  retryPrompt += '\nPlease try a different approach.';

  return retryPrompt;
}

function buildEscalationReason(history: EscalationResult['retryHistory'], strategy: EscalationStrategy): string {
  const attempts = history.length;
  const lastError = history[history.length - 1]?.error || 'Unknown error';
  return `Codex failed after ${attempts} attempt(s). Last error: ${lastError}. Strategy: ${strategy}. Escalating to Claude for manual handling.`;
}
