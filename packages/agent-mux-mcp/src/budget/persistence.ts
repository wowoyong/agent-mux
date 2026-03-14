import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { UsageRecord } from '../types.js';

const USAGE_DIR = join(homedir(), '.agent-mux', 'usage');
const USAGE_FILE = join(USAGE_DIR, 'usage.jsonl');

export async function ensureUsageDir(): Promise<void> {
  await fs.mkdir(USAGE_DIR, { recursive: true });
}

export async function appendUsageRecord(record: UsageRecord): Promise<void> {
  await ensureUsageDir();
  const line = JSON.stringify(record) + '\n';
  await fs.appendFile(USAGE_FILE, line, 'utf-8');
}

export async function loadUsageRecords(sinceMs?: number): Promise<UsageRecord[]> {
  try {
    const content = await fs.readFile(USAGE_FILE, 'utf-8');
    const records: UsageRecord[] = [];
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line) as UsageRecord;
        if (sinceMs && record.timestamp < sinceMs) continue;
        records.push(record);
      } catch { /* skip malformed lines */ }
    }
    return records;
  } catch {
    return []; // file doesn't exist yet
  }
}

export async function getUsageSummary(windowMs: number): Promise<{ claude: number; codex: number }> {
  const since = Date.now() - windowMs;
  const records = await loadUsageRecords(since);
  return {
    claude: records.filter(r => r.agent === 'claude').length,
    codex: records.filter(r => r.agent === 'codex').length,
  };
}

export async function cleanupOldRecords(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  // Keep only records from the last 7 days
  const cutoff = Date.now() - maxAgeMs;
  const records = await loadUsageRecords();
  const kept = records.filter(r => r.timestamp >= cutoff);
  const removed = records.length - kept.length;
  if (removed > 0) {
    await ensureUsageDir();
    const content = kept.map(r => JSON.stringify(r)).join('\n') + '\n';
    await fs.writeFile(USAGE_FILE, content, 'utf-8');
  }
  return removed;
}
