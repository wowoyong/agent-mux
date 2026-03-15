/**
 * Task Classifier & Router
 * Analyzes task descriptions, extracts signals, and routes to Claude or Codex.
 * Implements a 2-phase routing system:
 *   Phase 1: Hard rules (deterministic, priority-ordered)
 *   Phase 2: Weighted scoring with interaction modifiers and budget adjustment
 */

import type { TaskSignals, RouteDecision, RouteTarget, TierName, RoutingLogEntry } from '../types.js';
import {
  SIGNAL_WEIGHTS,
  INTERACTION_MODIFIERS,
  CONFIDENCE_THRESHOLD,
  extractComplexity,
  extractFilePatterns,
} from './signals.js';
import { HARD_RULES } from './rules.js';
import { logRoutingDecision, loadOverrides, matchOverride } from './history.js';
import { debug } from '../cli/debug.js';

// ─── Keyword Patterns ───────────────────────────────────────────────

/** Patterns that suggest the task is better suited for Codex */
const CODEX_KEYWORDS: Array<{ pattern: RegExp; signal: keyof TaskSignals }> = [
  { pattern: /write\s+(unit\s+)?tests?\s+(for|to)/i, signal: 'isTestWriting' },
  { pattern: /create\s+(a\s+)?(new\s+)?(file|component|module)/i, signal: 'isSelfContained' },
  { pattern: /add\s+(jsdoc|tsdoc|docstring|comments?|docs?)/i, signal: 'isDocGeneration' },
  { pattern: /fix\s+(lint|linting|eslint|prettier|formatting)/i, signal: 'isSelfContained' },
  { pattern: /rename\s+\w+\s+(to|as|into)/i, signal: 'isRefactoring' },
  { pattern: /implement\s+(the\s+)?(api\s+)?endpoint/i, signal: 'isSelfContained' },
  { pattern: /update\s+(dependencies|packages?|deps)/i, signal: 'isSelfContained' },
  { pattern: /convert\s+\w+\s+(to|from|into)/i, signal: 'isRefactoring' },
  { pattern: /\brefactor\b/i, signal: 'isRefactoring' },
  { pattern: /fix\s+(this|the)\s+(bug|error|issue)/i, signal: 'isDebugging' },
];

/** Patterns that suggest the task is better suited for Claude */
const CLAUDE_KEYWORDS: Array<{ pattern: RegExp; signal: keyof TaskSignals }> = [
  { pattern: /architect(ure)?\s+(for|of|the)/i, signal: 'isArchitectural' },
  { pattern: /\barchitecture\b/i, signal: 'isArchitectural' },
  { pattern: /\barchitect\b/i, signal: 'isArchitectural' },
  { pattern: /design\s+(\w+\s+)*?(system|pattern|solution|architecture)/i, signal: 'isArchitectural' },
  { pattern: /\bdesign\b.*\b(system|architecture)\b/i, signal: 'isArchitectural' },
  { pattern: /\bscaffold\b/i, signal: 'isScaffolding' },
  { pattern: /debug\s+(this|the|a)\s+(\w+\s+)*(error|issue|crash|bug)/i, signal: 'isDebugging' },
  { pattern: /\bdebug\b.*\b(crash|error|issue|bug)\b/i, signal: 'isDebugging' },
  { pattern: /review\s+(this|the|my)\s+(code|pr|changes?)/i, signal: 'isCodeReview' },
  { pattern: /explain\s+(why|how|what|the)/i, signal: 'needsConversationContext' },
  { pattern: /refactor\s+(\w+\s+)*?(multiple|several|all|across)/i, signal: 'isMultiFileOrchestration' },
  { pattern: /\brefactor\b.*\b(multiple|across|several)\b/i, signal: 'isMultiFileOrchestration' },
  { pattern: /security\s+(audit|review|scan|check)/i, signal: 'isSecurityAudit' },
  { pattern: /best\s+(approach|way|strategy|practice)/i, signal: 'isArchitectural' },
];

/** Korean patterns that suggest the task is better suited for Codex */
const CODEX_KEYWORDS_KO: Array<{ pattern: RegExp; signal: keyof TaskSignals }> = [
  { pattern: /테스트\s*(작성|만들|추가|생성)/i, signal: 'isTestWriting' },
  { pattern: /문서\s*(작성|추가|생성)|주석\s*(추가|작성)/i, signal: 'isDocGeneration' },
  { pattern: /린트\s*(수정|고치|해결)|포맷팅\s*(수정|적용)/i, signal: 'isSelfContained' },
  { pattern: /리네이밍|이름\s*(변경|바꿔|바꾸)/i, signal: 'isRefactoring' },
  { pattern: /엔드포인트\s*(구현|추가|만들)/i, signal: 'isSelfContained' },
  { pattern: /의존성\s*(업데이트|갱신)|패키지\s*(업데이트|갱신)/i, signal: 'isSelfContained' },
  { pattern: /버그\s*(수정|고치|해결)|에러\s*(수정|고치|해결)/i, signal: 'isDebugging' },
  { pattern: /파일\s*(생성|만들|추가)/i, signal: 'isSelfContained' },
  { pattern: /리팩토링\s*(해줘|해주세요|하자)/i, signal: 'isRefactoring' },
];

/** Korean patterns that suggest the task is better suited for Claude */
const CLAUDE_KEYWORDS_KO: Array<{ pattern: RegExp; signal: keyof TaskSignals }> = [
  { pattern: /아키텍처\s*(설계|디자인|구성)/i, signal: 'isArchitectural' },
  { pattern: /설계\s*(해줘|해주세요|하자)/i, signal: 'isArchitectural' },
  { pattern: /디버그|디버깅/i, signal: 'isDebugging' },
  { pattern: /코드\s*리뷰|리뷰\s*(해줘|해주세요)/i, signal: 'isCodeReview' },
  { pattern: /설명\s*(해줘|해주세요)|왜\s*(그런|이런)/i, signal: 'needsConversationContext' },
  { pattern: /보안\s*(검사|감사|리뷰|체크)/i, signal: 'isSecurityAudit' },
  { pattern: /스캐폴딩|프로젝트\s*(생성|구조|셋업)/i, signal: 'isScaffolding' },
  { pattern: /여러\s*파일|다수\s*파일|전체\s*파일/i, signal: 'isMultiFileOrchestration' },
];

// ─── Signal Extraction ──────────────────────────────────────────────

/**
 * Analyze a task description and extract all routing signals.
 * This is a local, 0-token operation using keyword matching.
 */
export function analyzeTask(taskDescription: string): TaskSignals {
  const complexity = extractComplexity(taskDescription);

  // Initialize all 20 signals
  const signals: TaskSignals = {
    // Claude-favoring (8)
    needsMCP: false,
    needsProjectContext: false,
    needsConversationContext: false,
    isInteractive: false,
    isArchitectural: false,
    isFrontend: false,
    isScaffolding: false,
    isMultiFileOrchestration: false,
    // Codex-favoring (8)
    isCodeReview: false,
    isSecurityAudit: false,
    isSelfContained: false,
    isTestWriting: false,
    isDocGeneration: false,
    isDebugging: false,
    isRefactoring: false,
    isTerminalTask: false,
    // Meta (4)
    estimatedFiles: 1,
    estimatedComplexity: complexity,
    isVerifiable: false,
    isUrgent: false,
  };

  const lower = taskDescription.toLowerCase();

  // Helper to set a boolean signal safely without double type assertion
  function setSignal(key: keyof TaskSignals, value: boolean): void {
    if (key in signals && typeof signals[key] === 'boolean') {
      (signals[key] as boolean) = value;
    }
  }

  // Run Codex keyword patterns
  for (const kw of CODEX_KEYWORDS) {
    if (kw.pattern.test(taskDescription)) {
      setSignal(kw.signal, true);
    }
  }

  // Run Claude keyword patterns
  for (const kw of CLAUDE_KEYWORDS) {
    if (kw.pattern.test(taskDescription)) {
      setSignal(kw.signal, true);
    }
  }

  // Run Korean Codex keyword patterns
  for (const kw of CODEX_KEYWORDS_KO) {
    if (kw.pattern.test(taskDescription)) {
      setSignal(kw.signal, true);
    }
  }

  // Run Korean Claude keyword patterns
  for (const kw of CLAUDE_KEYWORDS_KO) {
    if (kw.pattern.test(taskDescription)) {
      setSignal(kw.signal, true);
    }
  }

  // Additional signal detection

  // MCP detection
  if (/\bmcp\b/i.test(lower) || /\btool\s*(call|use|integration)/i.test(lower) ||
      /\bfetch\s+(from|url|api)/i.test(lower) || /\bdatabase\s+(query|insert|update)/i.test(lower)) {
    signals.needsMCP = true;
  }

  // Project context detection
  if (/\bproject\b/i.test(lower) || /\bcodebase\b/i.test(lower) ||
      /\bacross\s+(the\s+)?(project|repo|codebase)/i.test(lower) ||
      /\bexisting\s+(code|implementation|pattern)/i.test(lower)) {
    signals.needsProjectContext = true;
  }

  // Conversation context detection
  if (/\b(previous|earlier|above|before|last\s+(message|response|answer))\b/i.test(lower) ||
      /\bwe\s+(discussed|talked|mentioned)/i.test(lower) ||
      /\bas\s+(i|we)\s+(said|mentioned)/i.test(lower)) {
    signals.needsConversationContext = true;
  }

  // Interactive detection
  if (/\binteractive/i.test(lower) || /\bstep[\s-]by[\s-]step/i.test(lower) ||
      /\bwalk\s+(me\s+)?through/i.test(lower) || /\bhelp\s+me\s+(understand|figure)/i.test(lower) ||
      /\blet'?s\s+(work|figure|think)/i.test(lower)) {
    signals.isInteractive = true;
  }

  // Frontend detection
  if (/\b(css|scss|style|layout|ui|ux|component|react|vue|angular|html|dom)\b/i.test(lower) ||
      /\b(responsive|animation|render|display)\b/i.test(lower)) {
    signals.isFrontend = true;
  }

  // Terminal task detection
  if (/\b(cli|terminal|command[\s-]line|shell|bash|script)\b/i.test(lower) ||
      /\b(npm|yarn|pnpm|cargo|pip)\s+(run|install|build)/i.test(lower)) {
    signals.isTerminalTask = true;
  }

  // Verifiable detection
  if (signals.isTestWriting || signals.isDocGeneration ||
      /\b(test|verify|check|validate|assert)\b/i.test(lower)) {
    signals.isVerifiable = true;
  }

  // Urgent detection
  if (/\b(urgent|asap|immediately|critical|hotfix|production\s+(issue|bug|down))\b/i.test(lower)) {
    signals.isUrgent = true;
  }

  // Self-contained detection (if not already set by keywords)
  if (!signals.isSelfContained && !signals.needsProjectContext && !signals.isMultiFileOrchestration) {
    if (/\b(single\s+file|one\s+file|this\s+file|standalone)\b/i.test(lower)) {
      signals.isSelfContained = true;
    }
  }

  // Estimate file count from description
  signals.estimatedFiles = estimateFileCount(taskDescription);

  return signals;
}

/**
 * Estimate the number of files a task will touch based on description.
 */
function estimateFileCount(description: string): number {
  const lower = description.toLowerCase();

  // Explicit file count mentions
  const countMatch = lower.match(/(\d+)\s+files?/);
  if (countMatch) {
    return Math.min(parseInt(countMatch[1], 10), 50);
  }

  // Multi-file indicators
  if (/\b(all|every|each|multiple|several|many|across)\s+(files?|modules?|components?)/i.test(lower)) {
    return 10;
  }

  // Single file indicators
  if (/\b(single|one|this)\s+file/i.test(lower)) {
    return 1;
  }

  // File patterns mentioned
  const filePatterns = extractFilePatterns(description);
  if (filePatterns.length > 0) {
    return Math.max(filePatterns.length, 1);
  }

  // Default
  return 2;
}

// ─── Async Wrapper (backward-compatible) ────────────────────────────

/**
 * Classify a task by analyzing its description and extracting routing signals.
 * Async wrapper for backward compatibility.
 */
export async function classifyTask(
  description: string,
): Promise<TaskSignals> {
  return analyzeTask(description);
}

// ─── 2-Phase Routing ────────────────────────────────────────────────

/**
 * Route a task to Claude or Codex using a 2-phase approach:
 *   Phase 1: Hard rules (deterministic)
 *   Phase 2: Weighted scoring with modifiers and budget adjustment
 *
 * @param signals - Extracted task signals
 * @param tier - Current subscription tier
 * @param claudeBudgetPct - Remaining Claude budget as fraction (0-1)
 * @param codexBudgetPct - Remaining Codex budget as fraction (0-1)
 * @returns Routing decision with target, confidence, and reason
 */
export function routeTask(
  signals: TaskSignals,
  tier: TierName = 'standard',
  claudeBudgetPct: number = 1.0,
  codexBudgetPct: number = 1.0,
  taskDescription: string = ''
): RouteDecision {
  // Phase 1: Check hard rules in priority order
  const sortedRules = [...HARD_RULES].sort((a, b) => a.priority - b.priority);
  for (const rule of sortedRules) {
    if (rule.condition(signals)) {
      const decision: RouteDecision = {
        target: rule.target,
        confidence: 1.0,
        reason: rule.reason,
        signals,
        escalated: false,
        matchedRule: rule.id,
      };
      // Log asynchronously (fire-and-forget)
      logRoutingDecisionAsync(taskDescription, signals, decision, 1);
      return decision;
    }
  }

  // Check learned overrides before Phase 2 scoring
  // loadOverrides is async, but we use a cached version synchronously
  const overrideResult = checkLearnedOverridesSync(signals);
  if (overrideResult) {
    const decision: RouteDecision = {
      target: overrideResult.forcedTarget,
      confidence: 0.9,
      reason: `Learned override applied (${overrideResult.count} past overrides matched)`,
      signals,
      escalated: false,
    };
    logRoutingDecisionAsync(taskDescription, signals, decision, 2);
    return decision;
  }

  // Phase 2: Weighted scoring
  let score = 0;
  const activeSignals: string[] = [];

  for (const [signal, weight] of Object.entries(SIGNAL_WEIGHTS)) {
    const value = signals[signal as keyof TaskSignals];
    if (value === true) {
      score += weight;
      activeSignals.push(signal);
      debug(`Signal: ${signal} = ${weight}`);
    }
  }

  // Apply interaction modifiers
  const appliedModifiers: string[] = [];
  for (const mod of INTERACTION_MODIFIERS) {
    if (mod.condition(signals)) {
      score += mod.adjustment;
      appliedModifiers.push(mod.reason);
    }
  }

  // Budget adjustment — push toward the agent with more remaining budget
  if (claudeBudgetPct < 0.2) {
    score += 50; // push toward Codex
  }
  if (codexBudgetPct < 0.2) {
    score -= 50; // push toward Claude
  }

  debug(`Routing score: ${score}, active signals: [${activeSignals.join(', ')}], modifiers: [${appliedModifiers.join('; ')}]`);

  // Calculate confidence as ratio of score magnitude to max possible score
  const maxScore = Object.values(SIGNAL_WEIGHTS).reduce(
    (sum, w) => sum + Math.abs(w),
    0
  );
  const confidence = Math.min(Math.abs(score) / maxScore, 1.0);

  // Determine target from score direction
  let target: RouteTarget = score > 0 ? 'codex' : 'claude';

  // Tiebreaker for ambiguous cases (low confidence)
  if (confidence < CONFIDENCE_THRESHOLD) {
    target = tier === 'budget' ? 'codex' : 'claude';
    const decision: RouteDecision = {
      target,
      confidence,
      reason: buildReason(target, activeSignals, appliedModifiers, true),
      signals,
      escalated: false,
    };
    logRoutingDecisionAsync(taskDescription, signals, decision, 2);
    return decision;
  }

  const decision: RouteDecision = {
    target,
    confidence,
    reason: buildReason(target, activeSignals, appliedModifiers, false),
    signals,
    escalated: false,
  };
  logRoutingDecisionAsync(taskDescription, signals, decision, 2);
  return decision;
}

/**
 * Build a human-readable reason string explaining the routing decision.
 */
function buildReason(
  target: RouteTarget,
  activeSignals: string[],
  appliedModifiers: string[],
  wasTiebroken: boolean
): string {
  const parts: string[] = [];

  if (wasTiebroken) {
    parts.push(`Low confidence — defaulted to ${target}`);
  } else {
    parts.push(`Routed to ${target}`);
  }

  if (activeSignals.length > 0) {
    const signalNames = activeSignals.slice(0, 4).join(', ');
    parts.push(`active signals: ${signalNames}`);
  }

  if (appliedModifiers.length > 0) {
    parts.push(`modifiers: ${appliedModifiers.join('; ')}`);
  }

  return parts.join(' | ');
}

// ─── Learned Override Cache ─────────────────────────────────────────

import type { LearnedOverride } from '../types.js';

let _cachedOverrides: LearnedOverride[] | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

function checkLearnedOverridesSync(signals: TaskSignals): LearnedOverride | null {
  // Use cached overrides; refresh async if stale
  if (_cachedOverrides === null || Date.now() - _cacheTimestamp > CACHE_TTL_MS) {
    // Trigger async refresh (fire-and-forget)
    loadOverrides().then(overrides => {
      _cachedOverrides = overrides;
      _cacheTimestamp = Date.now();
    }).catch(() => {});
  }

  if (_cachedOverrides && _cachedOverrides.length > 0) {
    return matchOverride(signals, _cachedOverrides);
  }
  return null;
}

/**
 * Refresh the learned overrides cache.
 * Call this on startup to warm the cache.
 */
export async function refreshOverridesCache(): Promise<void> {
  _cachedOverrides = await loadOverrides();
  _cacheTimestamp = Date.now();
}

// ─── Async Logging Helper ───────────────────────────────────────────

function logRoutingDecisionAsync(
  taskDescription: string,
  signals: TaskSignals,
  decision: RouteDecision,
  phase: 1 | 2
): void {
  const entry: RoutingLogEntry = {
    timestamp: Date.now(),
    taskSummary: taskDescription.slice(0, 200),
    signals,
    decision: {
      target: decision.target,
      confidence: decision.confidence,
      reason: decision.reason,
      phase,
    },
  };
  // Fire-and-forget
  logRoutingDecision(entry).catch(() => {});
}

// ─── General Chat Detection ─────────────────────────────────────────

/**
 * Detect whether user input is a coding task or general chat.
 * Returns true if any coding-related keyword is present.
 */
export function isCodingTask(taskDescription: string): boolean {
  const codingIndicators = [
    /\b(write|create|build|implement|add|fix|debug|refactor|test|deploy|update|delete|remove|rename|scaffold|design|architect|review|audit|lint|format|document|generate|convert|migrate|optimize|configure)\b/i,
    /\b(function|class|module|component|api|endpoint|database|server|client|frontend|backend|service|controller|model|schema|type|interface|route|middleware|hook|handler|util|helper|test|spec)\b/i,
    /\b(bug|error|crash|issue|feature|task|ticket|pr|pull request|commit|branch|merge|deploy|release)\b/i,
    /\.(ts|js|py|rb|go|rs|java|cpp|c|h|css|html|jsx|tsx|vue|svelte|json|yaml|yml|toml|sql|sh|bash|zsh)$/i,
    // Korean coding keywords
    /\b(테스트|코드|함수|클래스|모듈|컴포넌트|버그|에러|리팩토링|배포|구현|생성|수정|삭제|디버그|설계|아키텍처)\b/,
  ];

  return codingIndicators.some(pattern => pattern.test(taskDescription));
}

// ─── User Override Recording ────────────────────────────────────────

/**
 * Record a user override for a previously routed task.
 * This logs the override and triggers learning for future routing.
 */
export async function recordUserOverride(
  taskDescription: string,
  override: RouteTarget
): Promise<void> {
  const signals = analyzeTask(taskDescription);
  const entry: RoutingLogEntry = {
    timestamp: Date.now(),
    taskSummary: taskDescription.slice(0, 200),
    signals,
    decision: {
      target: override === 'claude' ? 'codex' : 'claude', // original was the opposite
      confidence: 0,
      reason: 'User override',
      phase: 2,
    },
    userOverride: override,
  };
  await logRoutingDecision(entry);
  // Refresh cache after learning
  await refreshOverridesCache();
}
