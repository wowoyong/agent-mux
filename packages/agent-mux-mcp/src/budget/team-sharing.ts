/**
 * Team Budget Sharing
 * Syncs budget usage across team members via a shared directory.
 * Each member writes their usage to a per-user JSONL file.
 * Aggregate reads all team members' files for total usage.
 *
 * Configuration:
 *   team:
 *     sharedDir: /path/to/shared/team-budget  (network drive, Dropbox, etc.)
 *     userId: alice                             (defaults to OS username)
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { hostname, userInfo } from 'node:os';
import type { UsageRecord } from '../types.js';
import { debug } from '../cli/debug.js';

export interface TeamConfig {
  sharedDir: string;
  userId?: string;
}

function getUserId(teamConfig?: TeamConfig): string {
  return teamConfig?.userId ?? userInfo().username ?? hostname();
}

/**
 * Append a usage record to the team's shared directory.
 * Each user gets their own file to avoid write conflicts.
 */
export async function appendTeamRecord(record: UsageRecord, teamConfig: TeamConfig): Promise<void> {
  const userId = getUserId(teamConfig);
  const userFile = join(teamConfig.sharedDir, `${userId}.jsonl`);

  try {
    await fs.mkdir(teamConfig.sharedDir, { recursive: true });
    const line = JSON.stringify({ ...record, userId }) + '\n';
    await fs.appendFile(userFile, line, 'utf-8');
  } catch (err) {
    debug('Failed to write team usage record:', err);
  }
}

/**
 * Load all team members' usage records from the shared directory.
 * Returns aggregated records from all .jsonl files.
 */
export async function loadTeamRecords(teamConfig: TeamConfig, sinceMs?: number): Promise<(UsageRecord & { userId: string })[]> {
  const records: (UsageRecord & { userId: string })[] = [];

  try {
    const files = await fs.readdir(teamConfig.sharedDir);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    for (const file of jsonlFiles) {
      const content = await fs.readFile(join(teamConfig.sharedDir, file), 'utf-8');
      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        try {
          const record = JSON.parse(line);
          if (sinceMs && record.timestamp < sinceMs) continue;
          records.push(record);
        } catch {
          // skip malformed lines
        }
      }
    }
  } catch (err) {
    debug('Failed to load team records:', err);
  }

  return records;
}

/**
 * Get team usage summary for a time window.
 */
export async function getTeamUsageSummary(teamConfig: TeamConfig, windowMs: number): Promise<{
  total: { claude: number; codex: number };
  byUser: Record<string, { claude: number; codex: number }>;
}> {
  const since = Date.now() - windowMs;
  const records = await loadTeamRecords(teamConfig, since);

  const byUser: Record<string, { claude: number; codex: number }> = {};
  let totalClaude = 0;
  let totalCodex = 0;

  for (const r of records) {
    if (!byUser[r.userId]) byUser[r.userId] = { claude: 0, codex: 0 };
    if (r.agent === 'claude') {
      byUser[r.userId].claude++;
      totalClaude++;
    } else {
      byUser[r.userId].codex++;
      totalCodex++;
    }
  }

  return {
    total: { claude: totalClaude, codex: totalCodex },
    byUser,
  };
}

/**
 * Format team usage for display.
 */
export function formatTeamUsage(
  summary: { total: { claude: number; codex: number }; byUser: Record<string, { claude: number; codex: number }> }
): string[] {
  const lines: string[] = [
    `Total: Claude ${summary.total.claude} | Codex ${summary.total.codex}`,
    '',
  ];

  const users = Object.entries(summary.byUser).sort((a, b) =>
    (b[1].claude + b[1].codex) - (a[1].claude + a[1].codex)
  );

  for (const [user, usage] of users) {
    lines.push(`  ${user.padEnd(15)} Claude: ${String(usage.claude).padStart(3)}  Codex: ${String(usage.codex).padStart(3)}`);
  }

  return lines;
}
