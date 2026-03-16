import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { RoutingLogEntry, LearnedOverride, TaskSignals, RouteTarget } from '../types.js';
import { debug } from '../cli/debug.js';

const LOG_DIR = join(homedir(), '.agent-mux', 'routing');
const LOG_FILE = join(LOG_DIR, 'routing-history.jsonl');
const OVERRIDES_FILE = join(LOG_DIR, 'learned-overrides.json');

async function ensureDir(): Promise<void> {
  await fs.mkdir(LOG_DIR, { recursive: true });
}

export async function logRoutingDecision(entry: RoutingLogEntry): Promise<void> {
  await ensureDir();
  await fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', 'utf-8');

  // If user override exists, learn from it
  if (entry.userOverride && entry.userOverride !== entry.decision.target) {
    await recordOverride(entry.signals, entry.userOverride);
  }
}

export async function getRoutingHistory(limit = 50): Promise<RoutingLogEntry[]> {
  try {
    const content = await fs.readFile(LOG_FILE, 'utf-8');
    const entries: RoutingLogEntry[] = [];
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try { entries.push(JSON.parse(line)); } catch (err) { debug('Skipping malformed routing history line:', err); }
    }
    return entries.slice(-limit);
  } catch (err) {
    debug('Failed to load routing history:', err);
    return [];
  }
}

export async function getRoutingStats(): Promise<{
  total: number;
  claudeCount: number;
  codexCount: number;
  overrideCount: number;
  successRate: number;
}> {
  const history = await getRoutingHistory(200);
  const total = history.length;
  const claudeCount = history.filter(e => e.decision.target === 'claude').length;
  const codexCount = history.filter(e => e.decision.target === 'codex').length;
  const overrideCount = history.filter(e => e.userOverride).length;
  const withOutcome = history.filter(e => e.outcome);
  const successRate = withOutcome.length > 0
    ? withOutcome.filter(e => e.outcome === 'success').length / withOutcome.length
    : 1;
  return { total, claudeCount, codexCount, overrideCount, successRate };
}

async function recordOverride(signals: Partial<TaskSignals>, target: RouteTarget): Promise<void> {
  const overrides = await loadOverrides();

  // Find similar existing override
  const key = buildSignalKey(signals);
  const existing = overrides.find(o => buildSignalKey(o.signalPattern) === key);

  if (existing) {
    existing.count++;
    existing.lastUsed = Date.now();
    existing.forcedTarget = target;
  } else {
    overrides.push({
      signalPattern: signals,
      forcedTarget: target,
      count: 1,
      lastUsed: Date.now(),
    });
  }

  await saveOverrides(overrides);
}

export async function loadOverrides(): Promise<LearnedOverride[]> {
  try {
    const content = await fs.readFile(OVERRIDES_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    debug('Failed to load overrides:', err);
    return [];
  }
}

async function saveOverrides(overrides: LearnedOverride[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(OVERRIDES_FILE, JSON.stringify(overrides, null, 2), 'utf-8');
}

export function matchOverride(signals: TaskSignals, overrides: LearnedOverride[]): LearnedOverride | null {
  // Find learned override that matches current signals
  // Require at least 2 past overrides to apply learned behavior
  for (const override of overrides) {
    if (override.count < 2) continue;

    let matchCount = 0;
    let totalKeys = 0;

    for (const [key, value] of Object.entries(override.signalPattern)) {
      if (typeof value === 'boolean' && value === true) {
        totalKeys++;
        if ((signals as any)[key] === true) matchCount++;
      }
    }

    // 70%+ signal match = apply the learned override
    if (totalKeys > 0 && matchCount / totalKeys >= 0.7) {
      return override;
    }
  }

  return null;
}

function buildSignalKey(signals: Partial<TaskSignals>): string {
  return Object.entries(signals)
    .filter(([_, v]) => typeof v === 'boolean' && v)
    .map(([k]) => k)
    .sort()
    .join(',');
}
