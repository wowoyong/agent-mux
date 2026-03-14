/**
 * Tier Definitions
 * Predefined tier configurations for different subscription combinations.
 */

import type { MuxConfig, TierName } from '../types.js';

/** Tier presets mapping */
export const TIER_PRESETS: Record<TierName, Partial<MuxConfig>> = {
  budget: {
    tier: 'budget',
    claude: { plan: 'pro', cost: 20 },
    codex: { plan: 'plus', cost: 20, mode: 'local' },
    routing: {
      engine: 'local',
      bias: 'codex',
      split: { claude: 30, codex: 70 },
      escalation: { enabled: true, strategy: 'fix', maxRetries: 1 },
    },
  },
  standard: {
    tier: 'standard',
    claude: { plan: 'pro', cost: 20 },
    codex: { plan: 'pro', cost: 200, mode: 'cloud_and_local' },
    routing: {
      engine: 'local',
      bias: 'balanced',
      split: { claude: 50, codex: 50 },
      escalation: { enabled: true, strategy: 'fix_then_redo', maxRetries: 2 },
    },
  },
  premium: {
    tier: 'premium',
    claude: { plan: 'max_5x', cost: 100 },
    codex: { plan: 'pro', cost: 200, mode: 'cloud_and_local' },
    routing: {
      engine: 'hybrid',
      bias: 'adaptive',
      split: { claude: 50, codex: 50 },
      escalation: { enabled: true, strategy: 'fix_then_redo', maxRetries: 2 },
    },
  },
  power: {
    tier: 'power',
    claude: { plan: 'max_20x', cost: 200 },
    codex: { plan: 'pro', cost: 200, mode: 'cloud_and_local' },
    routing: {
      engine: 'hybrid',
      bias: 'adaptive',
      split: { claude: 40, codex: 60 },
      escalation: { enabled: true, strategy: 'full', maxRetries: 3 },
    },
  },
};

/**
 * Get the preset configuration for a given tier.
 *
 * @param tier - The tier name
 * @returns Partial configuration for the tier
 */
export function getTierPreset(tier: TierName): Partial<MuxConfig> {
  return TIER_PRESETS[tier];
}
