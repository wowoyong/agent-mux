/**
 * Core Engine Event Types
 * UI-independent event stream definitions for the MuxEngine API.
 */

import type { BudgetStatus, RouteDecision, RouteTarget } from '../types.js';

export type RouteResult = RouteDecision;

export interface RouteOptions {
  dryRun?: boolean;
  route?: RouteTarget;
  verbose?: boolean;
}

export type MuxEvent =
  | { type: 'routing'; decision: RouteResult }
  | { type: 'stream'; chunk: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_use'; tool: string; input: Record<string, unknown> }
  | { type: 'tool_result'; output: string }
  | { type: 'diff'; patch: string; files: string[] }
  | { type: 'file_list'; files: string[]; additions: number; deletions: number }
  | { type: 'confirm'; id: string; prompt: string; options: string[] }
  | { type: 'progress'; message: string; elapsed: number }
  | { type: 'error'; message: string; recoverable: boolean }
  | { type: 'done'; summary: string }
  | { type: 'budget_update'; budget: BudgetStatus };
