/**
 * Tool: get_mux_status
 * Returns the full orchestration status including config, budget, and task history.
 */

import type { GetMuxStatusToolInput, MuxStatus } from '../types.js';

/**
 * Get the full orchestration status.
 *
 * @param input - Options for including history and limiting results
 * @returns Full mux orchestration status
 */
export async function getStatus(input: GetMuxStatusToolInput): Promise<MuxStatus> {
  // TODO: Implement status retrieval
  throw new Error('Not implemented: getStatus');
}
