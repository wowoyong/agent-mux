/**
 * Task Decomposer
 * Analyzes complex tasks and decomposes them into subtasks with routing recommendations.
 * Uses local keyword analysis only — no LLM calls.
 */

import type { SubTask, DecompositionResult, TaskSignals, RouteTarget } from '../types.js';
import { analyzeTask } from './classifier.js';

/**
 * Determine whether a task should be decomposed based on its description and signals.
 * Decompose when:
 * 1. Task mentions multiple independent operations (detected by "and", "also", numbered lists)
 * 2. Task affects many files across different modules
 * 3. Task has both analysis (Claude) and implementation (Codex) components
 */
export function shouldDecompose(taskDescription: string, signals: TaskSignals): boolean {
  const multipleOps = /\band\b.*\band\b/i.test(taskDescription) ||
                      /\d+\.\s+.+\n\d+\.\s+/m.test(taskDescription) ||
                      taskDescription.split(/[,;]/).length >= 3;

  const highFileCount = signals.estimatedFiles > 8;
  const mixedSignals = hasMixedSignals(signals);

  return (multipleOps && highFileCount) || (multipleOps && mixedSignals);
}

/**
 * Check whether signals contain both Claude-favoring and Codex-favoring indicators.
 */
function hasMixedSignals(signals: TaskSignals): boolean {
  const claudeSignals = [signals.isArchitectural, signals.needsProjectContext, signals.isMultiFileOrchestration].filter(Boolean).length;
  const codexSignals = [signals.isTestWriting, signals.isSelfContained, signals.isDocGeneration, signals.isRefactoring].filter(Boolean).length;
  return claudeSignals > 0 && codexSignals > 0;
}

/**
 * Decompose a task description into subtasks with routing recommendations.
 * Returns a DecompositionResult indicating whether decomposition is warranted
 * and, if so, the list of subtasks with dependencies and execution strategy.
 */
export function decomposeTask(taskDescription: string): DecompositionResult {
  const signals = analyzeTask(taskDescription);

  if (!shouldDecompose(taskDescription, signals)) {
    return {
      shouldDecompose: false,
      reason: 'Task is simple enough for single-agent execution',
      subtasks: [],
      executionStrategy: 'sequential',
    };
  }

  // Split by common delimiters
  const parts = splitTaskParts(taskDescription);

  if (parts.length <= 1) {
    return {
      shouldDecompose: false,
      reason: 'Could not identify independent subtasks',
      subtasks: [],
      executionStrategy: 'sequential',
    };
  }

  const subtasks: SubTask[] = parts.map((part, i) => {
    const partSignals = analyzeTask(part);
    const target = determineTarget(partSignals);

    return {
      id: `subtask-${i + 1}`,
      description: part.trim(),
      recommendedTarget: target,
      dependencies: [], // filled in below
      estimatedFiles: partSignals.estimatedFiles,
      priority: i + 1,
    };
  });

  // Determine dependencies: Claude tasks (planning/design) should run before Codex tasks (implementation)
  const claudeTasks = subtasks.filter(s => s.recommendedTarget === 'claude');
  const codexTasks = subtasks.filter(s => s.recommendedTarget === 'codex');

  // Codex tasks depend on Claude tasks completing first
  for (const codexTask of codexTasks) {
    codexTask.dependencies = claudeTasks.map(t => t.id);
  }

  // Determine execution strategy
  const strategy = claudeTasks.length > 0 && codexTasks.length > 0
    ? 'fan-out'  // Claude first, then fan-out Codex tasks
    : codexTasks.length > 1
      ? 'parallel'
      : 'sequential';

  return {
    shouldDecompose: true,
    reason: `Task decomposed into ${subtasks.length} subtasks (${claudeTasks.length} Claude, ${codexTasks.length} Codex)`,
    subtasks,
    executionStrategy: strategy,
  };
}

/**
 * Split a task description into parts using common delimiters.
 * Tries numbered lists, bullet points, conjunctions, and semicolons in order.
 */
function splitTaskParts(description: string): string[] {
  // Try numbered list first (1. xxx 2. xxx)
  const numbered = description.match(/\d+[\.\)]\s+[^\d]+/g);
  if (numbered && numbered.length >= 2) return numbered;

  // Try bullet points
  const bullets = description.split(/\n\s*[-•*]\s+/).filter(Boolean);
  if (bullets.length >= 2) return bullets;

  // Try "and" / "also" splitting
  const andSplit = description.split(/\s+(?:and|also|then|그리고|또한|그 다음)\s+/i);
  if (andSplit.length >= 2) return andSplit;

  // Try comma/semicolon
  const commaSplit = description.split(/[;]\s*/);
  if (commaSplit.length >= 2) return commaSplit;

  return [description];
}

/**
 * Determine the recommended routing target for a subtask based on its signals.
 */
function determineTarget(signals: TaskSignals): RouteTarget {
  // Simple heuristic for subtask routing
  if (signals.isArchitectural || signals.needsProjectContext || signals.isMultiFileOrchestration) return 'claude';
  if (signals.isTestWriting || signals.isDocGeneration || signals.isSelfContained || signals.isRefactoring) return 'codex';
  return 'claude'; // default to Claude for ambiguous subtasks
}
