import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// PTY commands
export async function spawnPty(cwd: string, shell?: string): Promise<string> {
  return invoke('spawn_pty', { cwd, shell });
}

export async function writePty(id: string, data: string): Promise<void> {
  return invoke('write_pty', { id, data });
}

export async function resizePty(id: string, cols: number, rows: number): Promise<void> {
  return invoke('resize_pty', { id, cols, rows });
}

export async function killPty(id: string): Promise<void> {
  return invoke('kill_pty', { id });
}

// PTY output event listener
export function onPtyOutput(id: string, callback: (data: string) => void): Promise<UnlistenFn> {
  return listen<{ id: string; data: string }>('pty-output', (event) => {
    if (event.payload.id === id) callback(event.payload.data);
  });
}

// Agent commands (placeholder for sidecar integration)
export async function routeTask(task: string, agent?: string): Promise<{ target: string; confidence: number; reason: string }> {
  return invoke('route_task', { task, agent });
}

export async function executeTask(task: string, agent: string, cwd: string): Promise<string> {
  return invoke('execute_task', { task, agent, cwd });
}

export function onAgentOutput(sessionId: string, callback: (data: string) => void): Promise<UnlistenFn> {
  return listen<{ sessionId: string; data: string }>('agent-output', (event) => {
    if (event.payload.sessionId === sessionId) callback(event.payload.data);
  });
}
