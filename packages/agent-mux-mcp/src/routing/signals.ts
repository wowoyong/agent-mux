/**
 * Signal Weights & Interaction Modifiers
 * Defines weights for routing signals and interaction-based adjustments.
 */

import type { TaskSignals } from '../types.js';

// ─── Signal Weights ─────────────────────────────────────────────────
// Negative = Claude-favoring, Positive = Codex-favoring

export const SIGNAL_WEIGHTS: Record<string, number> = {
  // Claude-favoring (negative = Claude)
  needsMCP: -100,              // hard rule
  needsProjectContext: -30,
  needsConversationContext: -100, // hard rule
  isInteractive: -100,         // hard rule
  isArchitectural: -40,
  isFrontend: -20,
  isScaffolding: -100,         // hard rule
  isMultiFileOrchestration: -35,
  // Codex-favoring (positive = Codex)
  isCodeReview: 25,
  isSecurityAudit: 30,
  isSelfContained: 35,
  isTestWriting: 40,
  isDocGeneration: 30,
  isDebugging: 15,
  isRefactoring: 20,
  isTerminalTask: 10,
};

export const CONFIDENCE_THRESHOLD = 0.65;

// ─── Interaction Modifiers ──────────────────────────────────────────

export interface InteractionModifier {
  name: string;
  condition: (s: TaskSignals) => boolean;
  adjustment: number;
  reason: string;
}

export const INTERACTION_MODIFIERS: InteractionModifier[] = [
  {
    name: 'refactor-with-context',
    condition: (s) => s.isRefactoring && s.needsProjectContext,
    adjustment: -40,
    reason: 'Refactoring with project context needs Claude',
  },
  {
    name: 'verifiable-debug',
    condition: (s) => s.isDebugging && s.isSelfContained && s.isVerifiable,
    adjustment: 30,
    reason: 'Self-contained verifiable debugging ideal for Codex',
  },
  {
    name: 'multifile-tests',
    condition: (s) => s.isTestWriting && s.estimatedFiles > 5,
    adjustment: -20,
    reason: 'Multi-file tests need cross-file awareness',
  },
  {
    name: 'security-review',
    condition: (s) => s.isCodeReview && s.isSecurityAudit,
    adjustment: 20,
    reason: 'Systematic security review suits Codex',
  },
  {
    name: 'complex-urgent',
    condition: (s) => s.estimatedComplexity === 'high' && s.isUrgent,
    adjustment: -25,
    reason: 'Complex urgent tasks benefit from Claude context',
  },
];

// ─── Utility Functions ──────────────────────────────────────────────

/**
 * Extract complexity signal from a task description.
 */
export function extractComplexity(description: string): TaskSignals['estimatedComplexity'] {
  const lower = description.toLowerCase();

  const highIndicators = [
    /architect/i, /redesign/i, /migrate/i, /overhaul/i,
    /complex/i, /multiple\s+(systems?|services?)/i,
    /distributed/i, /large[\s-]scale/i,
  ];

  const lowIndicators = [
    /simple/i, /trivial/i, /typo/i, /rename/i,
    /fix\s+(a\s+)?typo/i, /update\s+(a\s+)?comment/i,
    /bump\s+version/i,
  ];

  if (highIndicators.some((p) => p.test(lower))) return 'high';
  if (lowIndicators.some((p) => p.test(lower))) return 'low';
  return 'medium';
}

/**
 * Extract file patterns from a task description.
 */
export function extractFilePatterns(description: string): string[] {
  const patterns: string[] = [];
  const fileRegex = /(?:[\w./\\-]+\.(?:ts|tsx|js|jsx|py|rs|go|java|css|scss|html|json|yaml|yml|toml|md))/g;
  let match: RegExpExecArray | null;
  while ((match = fileRegex.exec(description)) !== null) {
    patterns.push(match[0]);
  }
  return patterns;
}

/**
 * Detect programming languages relevant to the task.
 */
export function detectLanguages(description: string, filePatterns: string[]): string[] {
  const langs = new Set<string>();
  const extMap: Record<string, string> = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript',
    '.js': 'JavaScript', '.jsx': 'JavaScript',
    '.py': 'Python', '.rs': 'Rust', '.go': 'Go',
    '.java': 'Java', '.css': 'CSS', '.scss': 'SCSS',
    '.html': 'HTML',
  };

  for (const fp of filePatterns) {
    const ext = fp.match(/\.[a-z]+$/i)?.[0];
    if (ext && extMap[ext]) langs.add(extMap[ext]);
  }

  const langKeywords: Record<string, RegExp> = {
    TypeScript: /\btypescript\b|\bts\b/i,
    JavaScript: /\bjavascript\b|\bjs\b/i,
    Python: /\bpython\b|\bpy\b/i,
    Rust: /\brust\b|\bcargo\b/i,
    Go: /\bgolang\b|\bgo\b/i,
    Java: /\bjava\b/i,
    React: /\breact\b|\bjsx\b|\btsx\b/i,
  };

  for (const [lang, pattern] of Object.entries(langKeywords)) {
    if (pattern.test(description)) langs.add(lang);
  }

  return [...langs];
}
