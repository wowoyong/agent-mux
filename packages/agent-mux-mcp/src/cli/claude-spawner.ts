import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

interface ClaudeResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
}

/**
 * Spawn Claude CLI in non-interactive print mode.
 * Uses execFile (not exec) to prevent shell injection.
 */
export async function spawnClaude(prompt: string, options?: {
  timeout?: number;
  model?: string;
}): Promise<ClaudeResult> {
  const timeoutMs = options?.timeout ?? 300_000; // 5 min default

  const args = [
    '-p', prompt,       // print mode (non-interactive, just output)
    '--no-input',       // don't wait for user input
  ];

  if (options?.model) {
    args.push('--model', options.model);
  }

  try {
    const { stdout } = await execFileAsync('claude', args, {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    return {
      success: true,
      output: stdout.trim(),
      exitCode: 0,
    };
  } catch (err: unknown) {
    const e = err as { code?: number; stdout?: string; stderr?: string; message?: string };
    return {
      success: e.code === 0,
      output: e.stdout?.trim() ?? '',
      error: e.stderr?.trim() ?? e.message ?? 'Unknown error',
      exitCode: e.code ?? 1,
    };
  }
}
