/**
 * Task Classifier
 * Analyzes a task description and extracts signals for routing decisions.
 */

import type { TaskSignals } from '../types.js';

/**
 * Classify a task by analyzing its description and extracting routing signals.
 *
 * @param description - Natural language task description
 * @param fileContext - Optional list of relevant file paths for context
 * @returns Extracted task signals
 */
export async function classifyTask(
  description: string,
  fileContext?: string[]
): Promise<TaskSignals> {
  // TODO: Implement task classification logic
  throw new Error('Not implemented: classifyTask');
}
