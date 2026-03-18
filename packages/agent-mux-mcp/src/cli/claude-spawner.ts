import { spawn } from 'node:child_process';
import chalk from 'chalk';
import { registerProcess, unregisterProcess } from './process-tracker.js';
import { debug } from './debug.js';
import { CLAUDE_TIMEOUT_DEFAULT } from '../constants.js';

interface ClaudeResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
}

/** Detect authentication errors from stderr output */
function isAuthError(text: string): boolean {
  return /401|authentication_error|OAuth.*expired|token.*expired|Failed to authenticate/i.test(text);
}

/** Format a user-friendly error message with fix suggestions */
function formatError(stderr: string): string {
  if (isAuthError(stderr)) {
    return 'Authentication failed — OAuth token expired.\n  Fix: Run `claude login` to re-authenticate, then retry.';
  }
  return stderr;
}

/**
 * Spawn Claude CLI in non-interactive print mode.
 * Supports streaming stdout to the terminal in real-time.
 * Detects auth errors early and kills the process to avoid hanging.
 */
export async function spawnClaude(prompt: string, options?: {
  timeout?: number;
  model?: string;
  stream?: boolean;
}): Promise<ClaudeResult> {
  return new Promise((resolve) => {
    const args = ['-p', prompt];

    if (options?.model) {
      args.push('--model', options.model);
    }

    debug('Spawning claude with args:', args);
    const proc = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    registerProcess(proc);

    let stdout = '';
    let stderr = '';
    let resolved = false;

    const finish = (result: ClaudeResult) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      unregisterProcess(proc);
      resolve(result);
    };

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      if (options?.stream !== false) {
        process.stdout.write(chalk.gray(text));
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;

      // Early exit on auth errors — don't wait for timeout
      if (isAuthError(stderr)) {
        proc.kill('SIGTERM');
        finish({
          success: false,
          output: '',
          error: formatError(stderr.trim()),
          exitCode: 1,
        });
      }
    });

    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        finish({
          success: false,
          output: '',
          error: 'Claude CLI not found. Install: npm install -g @anthropic-ai/claude-code',
          exitCode: 127,
        });
      } else {
        finish({
          success: false,
          output: '',
          error: err.message,
          exitCode: 1,
        });
      }
    });

    const timer = setTimeout(() => proc.kill('SIGTERM'), options?.timeout ?? CLAUDE_TIMEOUT_DEFAULT);

    proc.on('close', (code) => {
      finish({
        success: code === 0,
        output: stdout.trim(),
        error: stderr.trim() ? formatError(stderr.trim()) : undefined,
        exitCode: code ?? 1,
      });
    });
  });
}
