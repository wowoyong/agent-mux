/**
 * Centralized timeout and interval constants for agent-mux.
 * Replaces hardcoded values across the codebase.
 */

/** Codex timeout for low-complexity tasks (3 min) */
export const CODEX_TIMEOUT_LOW = 180_000;

/** Codex timeout for medium-complexity tasks (7 min) */
export const CODEX_TIMEOUT_MEDIUM = 420_000;

/** Codex timeout for high-complexity tasks (15 min) */
export const CODEX_TIMEOUT_HIGH = 900_000;

/** Codex timeout safety cap for Plus tier (8 min) */
export const CODEX_TIMEOUT_PLUS_CAP = 480_000;

/** Stall detection threshold — kill process if no output for this long (90 sec) */
export const STALL_THRESHOLD = 90_000;

/** How often to check for stalled processes (5 sec) */
export const STALL_CHECK_INTERVAL = 5_000;

/** Default timeout for Claude CLI spawner (5 min) */
export const CLAUDE_TIMEOUT_DEFAULT = 300_000;
