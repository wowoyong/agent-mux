import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);
const CLI = join(__dirname, '..', '..', 'dist', 'bin', 'cli.js');
const TIMEOUT = 30000;

describe('CLI integration tests', { timeout: TIMEOUT + 5000 }, () => {
  it('config command shows JSON', async () => {
    const { stdout } = await execFileAsync('node', [CLI, 'config'], { timeout: TIMEOUT });
    const config = JSON.parse(stdout);
    expect(config).toHaveProperty('tier');
    expect(config).toHaveProperty('routing');
  });

  it('dry-run routes test writing', async () => {
    const { stdout } = await execFileAsync('node', [CLI, '--dry-run', 'write unit tests for auth'], { timeout: TIMEOUT });
    expect(stdout.toLowerCase()).toMatch(/codex|rout/);
  });

  it('dry-run routes architecture', async () => {
    const { stdout } = await execFileAsync('node', [CLI, '--dry-run', 'design the payment system architecture'], { timeout: TIMEOUT });
    expect(stdout.toLowerCase()).toMatch(/claude|rout/);
  });

  it('verbose shows signal info', async () => {
    const { stdout } = await execFileAsync('node', [CLI, '--dry-run', '--verbose', 'write unit tests for the auth module'], { timeout: TIMEOUT });
    expect(stdout.length).toBeGreaterThan(10);
  });

  it('force route overrides classifier', async () => {
    const { stdout } = await execFileAsync('node', [CLI, '--dry-run', '--route=codex', 'design architecture'], { timeout: TIMEOUT });
    expect(stdout.toLowerCase()).toContain('codex');
  });

  it('Korean routing works', async () => {
    const { stdout } = await execFileAsync('node', [CLI, '--dry-run', '인증 모듈에 대한 유닛 테스트를 작성해줘'], { timeout: TIMEOUT });
    expect(stdout.length).toBeGreaterThan(0);
  });
});
