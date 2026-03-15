import { spawn } from 'node:child_process';
import chalk from 'chalk';
import { registerProcess, unregisterProcess } from './process-tracker.js';

interface ClaudeResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
}

/**
 * Spawn Claude CLI in non-interactive print mode.
 * Supports streaming stdout to the terminal in real-time.
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

    const proc = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    registerProcess(proc);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      if (options?.stream !== false) {
        process.stdout.write(chalk.gray(text));
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err: NodeJS.ErrnoException) => {
      unregisterProcess(proc);
      if (err.code === 'ENOENT') {
        resolve({
          success: false,
          output: '',
          error: 'Claude CLI not found. Install: npm install -g @anthropic-ai/claude-code',
          exitCode: 127,
        });
      } else {
        resolve({
          success: false,
          output: '',
          error: err.message,
          exitCode: 1,
        });
      }
    });

    const timeout = setTimeout(() => proc.kill('SIGTERM'), options?.timeout ?? 300_000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      unregisterProcess(proc);
      resolve({
        success: code === 0,
        output: stdout.trim(),
        error: stderr.trim() || undefined,
        exitCode: code ?? 1,
      });
    });
  });
}
