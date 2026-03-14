/**
 * MCP Server for agent-mux.
 * Exposes tools for spawning Codex, checking budget, and getting orchestration status.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawnCodex } from './tools/spawn-codex.js';
import { checkBudget } from './tools/check-budget.js';
import { getStatus } from './tools/get-status.js';

/**
 * Create and configure the MCP server with all agent-mux tools.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'agent-mux-mcp',
    version: '0.1.0',
  });

  // Register spawn_codex tool
  server.tool(
    'spawn_codex',
    'Spawn Codex CLI for a task in isolated worktree',
    {
      prompt: z.string().describe('The task prompt to send to Codex'),
      workdir: z.string().optional().describe('Working directory for Codex'),
      useWorktree: z.boolean().optional().describe('Whether to use a git worktree for isolation'),
      approvalMode: z.enum(['suggest', 'auto-edit', 'full-auto']).optional().describe('Codex approval mode'),
      timeoutSeconds: z.number().optional().describe('Maximum execution time in seconds'),
    },
    async (params) => {
      const result = await spawnCodex(params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // Register check_budget tool
  server.tool(
    'check_budget',
    'Check remaining Claude and Codex budget',
    {
      agent: z.enum(['claude', 'codex']).optional().describe('Specific agent to check, or omit for both'),
    },
    async (params) => {
      const result = await checkBudget(params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // Register get_mux_status tool
  server.tool(
    'get_mux_status',
    'Get full orchestration status',
    {
      includeHistory: z.boolean().optional().describe('Include completed task history'),
      limit: z.number().optional().describe('Max number of history items'),
    },
    async (params) => {
      const result = await getStatus(params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  return server;
}

/**
 * Start the MCP server using stdio transport.
 */
export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
