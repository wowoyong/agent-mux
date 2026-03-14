import { spawn } from 'node:child_process';
import chalk from 'chalk';

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
    const args = ['-p', prompt, '--no-input'];

    if (options?.model) {
      args.push('--model', options.model);
    }

    const proc = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'] });

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

    const timeout = setTimeout(() => proc.kill('SIGTERM'), options?.timeout ?? 300_000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolve({
        success: code === 0,
        output: stdout.trim(),
        error: stderr.trim() || undefined,
        exitCode: code ?? 1,
      });
    });
  });
}
