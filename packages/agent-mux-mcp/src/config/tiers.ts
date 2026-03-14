/**
 * Tier Definitions
 * Predefined tier configurations for different subscription combinations.
 *
 * Budget:   Pro $20      + Plus $20  = $40   | local engine  | codex bias    | 30:70
 * Standard: Max 5x $100  + Plus $20  = $120  | local engine  | balanced      | 55:45
 * Premium:  Max 20x $200 + Plus $20  = $220  | hybrid engine | claude bias   | 70:30
 * Power:    Max 20x $200 + Pro $200  = $400  | hybrid engine | adaptive      | 65:35
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
    claude: { plan: 'max_5x', cost: 100 },
    codex: { plan: 'plus', cost: 20, mode: 'local' },
    routing: {
      engine: 'local',
      bias: 'balanced',
      split: { claude: 55, codex: 45 },
      escalation: { enabled: true, strategy: 'fix_then_redo', maxRetries: 2 },
    },
  },
  premium: {
    tier: 'premium',
    claude: { plan: 'max_20x', cost: 200 },
    codex: { plan: 'plus', cost: 20, mode: 'cloud_and_local' },
    routing: {
      engine: 'hybrid',
      bias: 'claude',
      split: { claude: 70, codex: 30 },
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
      split: { claude: 65, codex: 35 },
      escalation: { enabled: true, strategy: 'full', maxRetries: 3 },
    },
  },
};

/** Rate limit constants per tier */
export const TIER_LIMITS: Record<TierName, {
  claudeMsg5hr: number;
  codexTasksDay: number;
  concurrent: number;
}> = {
  budget:   { claudeMsg5hr: 45,  codexTasksDay: 200,      concurrent: 1 },
  standard: { claudeMsg5hr: 225, codexTasksDay: 200,      concurrent: 1 },
  premium:  { claudeMsg5hr: 900, codexTasksDay: 200,      concurrent: 1 },
  power:    { claudeMsg5hr: 900, codexTasksDay: Infinity,  concurrent: 3 },
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
