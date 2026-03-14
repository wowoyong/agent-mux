/**
 * Rate Limit Detector
 * Detects rate limit responses and triggers automatic routing changes.
 * Currently a stub — will be enhanced with real detection in future versions.
 */

export interface RateLimitEvent {
  agent: 'claude' | 'codex';
  timestamp: number;
  retryAfterMs?: number;
  message: string;
}

const rateLimitHistory: RateLimitEvent[] = [];

export function recordRateLimitHit(agent: 'claude' | 'codex', retryAfterMs?: number): void {
  rateLimitHistory.push({
    agent,
    timestamp: Date.now(),
    retryAfterMs,
    message: `${agent} rate limit hit at ${new Date().toISOString()}`,
  });
}

export function isRateLimited(agent: 'claude' | 'codex'): boolean {
  const recent = rateLimitHistory.filter(
    e => e.agent === agent && Date.now() - e.timestamp < (e.retryAfterMs ?? 300_000)
  );
  return recent.length > 0;
}

export function getRecommendedTarget(): 'claude' | 'codex' | null {
  if (isRateLimited('claude') && !isRateLimited('codex')) return 'codex';
  if (isRateLimited('codex') && !isRateLimited('claude')) return 'claude';
  return null;
}

export function getRateLimitHistory(): RateLimitEvent[] {
  return [...rateLimitHistory];
}

export function clearRateLimitHistory(): void {
  rateLimitHistory.length = 0;
}
