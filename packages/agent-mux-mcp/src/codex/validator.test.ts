import { describe, it, expect } from 'vitest';
import { validateFileScope, simpleGlobMatch, validateOutput } from './validator.js';
import type { SpawnCodexOutput } from '../types.js';

// ─── simpleGlobMatch Tests ──────────────────────────────────────────

describe('simpleGlobMatch', () => {
  describe('exact basename matching', () => {
    it('matches exact filename', () => {
      expect(simpleGlobMatch('package.json', 'package.json')).toBe(true);
    });

    it('matches filename in subdirectory', () => {
      expect(simpleGlobMatch('src/package.json', 'package.json')).toBe(true);
    });

    it('matches Dockerfile', () => {
      expect(simpleGlobMatch('Dockerfile', 'Dockerfile')).toBe(true);
    });

    it('matches Makefile', () => {
      expect(simpleGlobMatch('Makefile', 'Makefile')).toBe(true);
    });
  });

  describe('wildcard * matching', () => {
    it('matches .env files with .env* pattern', () => {
      expect(simpleGlobMatch('.env', '.env*')).toBe(true);
      expect(simpleGlobMatch('.env.local', '.env*')).toBe(true);
      expect(simpleGlobMatch('.env.production', '.env*')).toBe(true);
    });

    it('matches pem files', () => {
      expect(simpleGlobMatch('server.pem', '*.pem')).toBe(true);
      expect(simpleGlobMatch('certs/ca.pem', '*.pem')).toBe(true);
    });

    it('matches key files', () => {
      expect(simpleGlobMatch('private.key', '*.key')).toBe(true);
      expect(simpleGlobMatch('ssl/server.key', '*.key')).toBe(true);
    });

    it('matches docker-compose variants', () => {
      expect(simpleGlobMatch('docker-compose.yml', 'docker-compose*.yml')).toBe(true);
      expect(simpleGlobMatch('docker-compose.dev.yml', 'docker-compose*.yml')).toBe(true);
    });

    it('does not match unrelated files', () => {
      expect(simpleGlobMatch('src/index.ts', '*.pem')).toBe(false);
      expect(simpleGlobMatch('README.md', '*.key')).toBe(false);
    });
  });

  describe('directory glob ** matching', () => {
    it('matches GitHub workflows', () => {
      expect(simpleGlobMatch('.github/workflows/ci.yml', '.github/workflows/*')).toBe(true);
      expect(simpleGlobMatch('.github/workflows/deploy.yml', '.github/workflows/*')).toBe(true);
    });

    it('matches circleci config', () => {
      expect(simpleGlobMatch('.circleci/config.yml', '.circleci/*')).toBe(true);
    });

    it('does not match non-matching paths', () => {
      expect(simpleGlobMatch('src/workflows/test.ts', '.github/workflows/*')).toBe(false);
    });
  });

  describe('? wildcard matching', () => {
    it('matches single character', () => {
      expect(simpleGlobMatch('file1.txt', 'file?.txt')).toBe(true);
      expect(simpleGlobMatch('fileAB.txt', 'file?.txt')).toBe(false);
    });
  });

  describe('leading ./ normalization', () => {
    it('strips leading ./ from path', () => {
      expect(simpleGlobMatch('./src/index.ts', 'src/index.ts')).toBe(true);
    });

    it('strips leading ./ from pattern', () => {
      expect(simpleGlobMatch('src/index.ts', './src/index.ts')).toBe(true);
    });
  });
});

// ─── validateFileScope Tests ────────────────────────────────────────

describe('validateFileScope', () => {
  it('blocks .env files', () => {
    const result = validateFileScope(['.env', '.env.local']);
    expect(result.passed).toBe(false);
    expect(result.deniedFiles).toContain('.env');
    expect(result.deniedFiles).toContain('.env.local');
  });

  it('blocks package.json', () => {
    const result = validateFileScope(['package.json']);
    expect(result.passed).toBe(false);
    expect(result.deniedFiles).toContain('package.json');
  });

  it('blocks GitHub workflow files', () => {
    const result = validateFileScope(['.github/workflows/ci.yml']);
    expect(result.passed).toBe(false);
    expect(result.deniedFiles).toContain('.github/workflows/ci.yml');
  });

  it('blocks Dockerfile', () => {
    const result = validateFileScope(['Dockerfile']);
    expect(result.passed).toBe(false);
    expect(result.deniedFiles).toContain('Dockerfile');
  });

  it('blocks key and pem files', () => {
    const result = validateFileScope(['server.key', 'cert.pem']);
    expect(result.passed).toBe(false);
    expect(result.deniedFiles).toContain('server.key');
    expect(result.deniedFiles).toContain('cert.pem');
  });

  it('blocks lock files', () => {
    const result = validateFileScope(['package-lock.json', 'yarn.lock']);
    expect(result.passed).toBe(false);
    expect(result.deniedFiles.length).toBe(2);
  });

  it('passes normal source files', () => {
    const result = validateFileScope(['src/index.ts', 'src/utils/helpers.ts', 'test/app.test.ts']);
    expect(result.passed).toBe(true);
    expect(result.deniedFiles).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.qualityScore).toBe(1.0);
  });

  it('passes with empty file list', () => {
    const result = validateFileScope([]);
    expect(result.passed).toBe(true);
    expect(result.deniedFiles).toEqual([]);
  });

  it('creates error issues for denied files', () => {
    const result = validateFileScope(['.env']);
    expect(result.issues.length).toBe(1);
    expect(result.issues[0]!.severity).toBe('error');
    expect(result.issues[0]!.file).toBe('.env');
  });

  it('sets qualityScore to 0 when files are denied', () => {
    const result = validateFileScope(['.env']);
    expect(result.qualityScore).toBe(0.0);
  });

  it('provides a message when files are denied', () => {
    const result = validateFileScope(['.env']);
    expect(result.message).toBeDefined();
    expect(result.message).toContain('.env');
  });

  it('has no message when all files pass', () => {
    const result = validateFileScope(['src/index.ts']);
    expect(result.message).toBeUndefined();
  });

  describe('custom deny list', () => {
    it('uses custom deny patterns', () => {
      const result = validateFileScope(['secrets.yaml'], ['*.yaml']);
      expect(result.passed).toBe(false);
      expect(result.deniedFiles).toContain('secrets.yaml');
    });

    it('allows files not matching custom deny list', () => {
      const result = validateFileScope(['src/index.ts'], ['*.yaml']);
      expect(result.passed).toBe(true);
    });

    it('does not use default list when custom list is provided', () => {
      // .env would be blocked by default list but not by custom list
      const result = validateFileScope(['.env'], ['*.yaml']);
      expect(result.passed).toBe(true);
    });
  });
});

// ─── validateOutput Tests ───────────────────────────────────────────

describe('validateOutput', () => {
  function makeOutput(overrides: Partial<SpawnCodexOutput> = {}): SpawnCodexOutput {
    return {
      success: true,
      taskId: 'test-123',
      worktreePath: '/tmp/worktree',
      branchName: 'codex/test',
      filesModified: ['src/index.ts'],
      stdout: '',
      stderr: '',
      exitCode: 0,
      durationMs: 5000,
      deniedFiles: [],
      jsonlEvents: 5,
      ...overrides,
    };
  }

  it('passes valid successful output', async () => {
    const result = await validateOutput(makeOutput());
    expect(result.valid).toBe(true);
    expect(result.qualityScore).toBeGreaterThan(0.5);
  });

  it('marks non-zero exit code as invalid', async () => {
    const result = await validateOutput(makeOutput({ exitCode: 1 }));
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.message.includes('non-zero'))).toBe(true);
  });

  it('warns about error in stderr', async () => {
    const result = await validateOutput(makeOutput({ stderr: 'Some error occurred' }));
    expect(result.issues.some(i => i.severity === 'warning')).toBe(true);
  });

  it('notes success with no changes', async () => {
    const result = await validateOutput(makeOutput({ filesModified: [] }));
    expect(result.issues.some(i => i.severity === 'info')).toBe(true);
  });

  it('fails when modified files match deny list', async () => {
    const result = await validateOutput(makeOutput({ filesModified: ['.env'] }));
    expect(result.passed).toBe(false);
    expect(result.deniedFiles).toContain('.env');
  });

  it('uses custom deny patterns', async () => {
    const result = await validateOutput(
      makeOutput({ filesModified: ['secrets.yaml'] }),
      ['*.yaml']
    );
    expect(result.passed).toBe(false);
  });

  it('accumulates quality score deductions', async () => {
    const result = await validateOutput(makeOutput({
      exitCode: 1,
      stderr: 'error: something failed',
      filesModified: ['.env'],
    }));
    expect(result.qualityScore).toBe(0);
    expect(result.valid).toBe(false);
  });

  it('clamps quality score to [0, 1]', async () => {
    const result = await validateOutput(makeOutput({
      exitCode: 1,
      stderr: 'error error error',
      filesModified: ['.env', 'package.json'],
    }));
    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    expect(result.qualityScore).toBeLessThanOrEqual(1);
  });
});
