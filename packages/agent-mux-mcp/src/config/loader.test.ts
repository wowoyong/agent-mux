import { describe, it, expect } from 'vitest';
import { validateConfig, getDefaultConfig } from './loader.js';
import type { MuxConfig } from '../types.js';

describe('validateConfig', () => {
  it('returns no errors for valid default config', () => {
    const config = getDefaultConfig('standard');
    expect(validateConfig(config)).toEqual([]);
  });

  it('returns no errors for all valid tiers', () => {
    for (const tier of ['budget', 'standard', 'premium', 'power'] as const) {
      const config = getDefaultConfig(tier);
      expect(validateConfig(config)).toEqual([]);
    }
  });

  it('detects invalid tier', () => {
    const config = structuredClone(getDefaultConfig('standard'));
    (config as any).tier = 'ultra';
    const errors = validateConfig(config);
    expect(errors.some(e => e.includes('tier'))).toBe(true);
  });

  it('detects invalid routing engine', () => {
    const config = structuredClone(getDefaultConfig('standard'));
    (config.routing as any).engine = 'cloud';
    const errors = validateConfig(config);
    expect(errors.some(e => e.includes('engine'))).toBe(true);
  });

  it('detects invalid routing bias', () => {
    const config = structuredClone(getDefaultConfig('standard'));
    (config.routing as any).bias = 'random';
    const errors = validateConfig(config);
    expect(errors.some(e => e.includes('bias'))).toBe(true);
  });

  it('detects split not summing to 100', () => {
    const config = structuredClone(getDefaultConfig('standard'));
    config.routing.split = { claude: 60, codex: 60 };
    const errors = validateConfig(config);
    expect(errors.some(e => e.includes('split'))).toBe(true);
  });

  it('detects negative cost', () => {
    const config = structuredClone(getDefaultConfig('standard'));
    config.claude.cost = -10;
    const errors = validateConfig(config);
    expect(errors.some(e => e.includes('Cost'))).toBe(true);
  });
});

describe('getDefaultConfig', () => {
  it('budget tier has codex bias', () => {
    const config = getDefaultConfig('budget');
    expect(config.routing.bias).toBe('codex');
    expect(config.routing.split.codex).toBeGreaterThan(config.routing.split.claude);
  });

  it('standard tier has balanced bias', () => {
    const config = getDefaultConfig('standard');
    expect(config.routing.bias).toBe('balanced');
  });

  it('all configs have valid splits', () => {
    for (const tier of ['budget', 'standard', 'premium', 'power'] as const) {
      const config = getDefaultConfig(tier);
      expect(config.routing.split.claude + config.routing.split.codex).toBe(100);
    }
  });

  it('all configs have deny list', () => {
    for (const tier of ['budget', 'standard', 'premium', 'power'] as const) {
      const config = getDefaultConfig(tier);
      expect(config.denyList).toBeDefined();
      expect(config.denyList!.length).toBeGreaterThan(0);
    }
  });

  it('all configs have warning thresholds', () => {
    for (const tier of ['budget', 'standard', 'premium', 'power'] as const) {
      const config = getDefaultConfig(tier);
      expect(config.budget.warnings.length).toBeGreaterThan(0);
      for (const w of config.budget.warnings) {
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(100);
      }
    }
  });
});
