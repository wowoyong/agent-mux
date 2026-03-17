import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, '..', '..', 'dist', 'bin', 'cli.js');

describe('CLI smoke tests', () => {
  it('shows help', () => {
    const out = execFileSync('node', [CLI, '--help'], { encoding: 'utf-8' });
    expect(out).toContain('agent-mux');
    expect(out).toContain('status');
  });

  it('shows version', () => {
    const out = execFileSync('node', [CLI, '--version'], { encoding: 'utf-8' });
    expect(out).toMatch(/\d+\.\d+\.\d+/);
  });

  it('dry-run routes without error', () => {
    const out = execFileSync('node', [CLI, '--dry-run', 'write tests for auth'], { encoding: 'utf-8' });
    expect(out).toContain('Routed to');
    expect(out).toContain('DRY RUN');
  });

  it('status command runs', () => {
    const out = execFileSync('node', [CLI, 'status'], { encoding: 'utf-8', timeout: 10000 });
    expect(out).toContain('agent-mux');
  });
});
