import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { debug } from './debug.js';

const SESSION_DIR = join(homedir(), '.agent-mux', 'sessions');
const CURRENT_SESSION = join(SESSION_DIR, 'current.json');

export interface SessionState {
  startedAt: number;
  lastActive: number;
  taskCount: number;
  cwd: string;
}

export async function saveSession(state: SessionState): Promise<void> {
  await fs.mkdir(SESSION_DIR, { recursive: true });
  await fs.writeFile(CURRENT_SESSION, JSON.stringify(state, null, 2), 'utf-8');
}

export async function loadSession(): Promise<SessionState | null> {
  try {
    const content = await fs.readFile(CURRENT_SESSION, 'utf-8');
    return JSON.parse(content);
  } catch (err) { debug('Failed to load session:', err); return null; }
}

export async function clearSession(): Promise<void> {
  try { await fs.unlink(CURRENT_SESSION); } catch (err) { debug('Failed to clear session:', err); }
}
