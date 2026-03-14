/**
 * Tool: decompose_task
 * Analyzes a complex task and decomposes it into subtasks with routing recommendations.
 */

import { decomposeTask } from '../routing/decomposer.js';
import type { DecompositionResult } from '../types.js';

/**
 * Handle a decompose_task tool call.
 *
 * @param input - Object containing the task description to decompose
 * @returns The decomposition result with subtasks and execution strategy
 */
export async function handleDecomposeTask(input: { taskDescription: string }): Promise<DecompositionResult> {
  return decomposeTask(input.taskDescription);
}
