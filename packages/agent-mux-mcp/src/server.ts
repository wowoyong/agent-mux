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
import { handleDecomposeTask } from './tools/decompose-task.js';

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
      worktreePath: z.string().optional().describe('Path to the git worktree to use'),
      timeout: z.number().optional().describe('Maximum execution time in ms (default 420000)'),
      complexity: z.enum(['low', 'medium', 'high']).optional().describe('Task complexity hint'),
      contextFiles: z.array(z.string()).optional().describe('Files to provide as context'),
      verifyStrategy: z.enum(['tests', 'lint', 'diff-review', 'none']).optional().describe('Verification strategy after completion'),
      denyList: z.array(z.string()).optional().describe('File patterns Codex is not allowed to modify'),
    },
    async (params) => {
      const escalation = await spawnCodex(params);
      const { finalResult, retryCount, escalatedToClaude, escalationReason, retryHistory } = escalation;

      const lines: string[] = [];
      lines.push(`Task ${finalResult.taskId}: ${finalResult.success ? 'SUCCESS' : 'FAILED'}`);
      lines.push(`Branch: ${finalResult.branchName}`);
      lines.push(`Worktree: ${finalResult.worktreePath}`);
      lines.push(`Duration: ${finalResult.durationMs}ms | Exit code: ${finalResult.exitCode}`);
      lines.push(`Files modified: ${finalResult.filesModified.length > 0 ? finalResult.filesModified.join(', ') : 'none'}`);
      if (finalResult.deniedFiles.length > 0) {
        lines.push(`Denied files: ${finalResult.deniedFiles.join(', ')}`);
      }
      lines.push(`Retries: ${retryCount}`);
      if (escalatedToClaude) {
        lines.push(`ESCALATED TO CLAUDE: ${escalationReason}`);
      }
      if (retryHistory.length > 0) {
        lines.push('');
        lines.push('Retry history:');
        for (const entry of retryHistory) {
          lines.push(`  Attempt ${entry.attempt}: exit=${entry.exitCode} error=${entry.error || 'none'} denied=[${entry.deniedFiles.join(', ')}]`);
        }
      }
      if (finalResult.stdout) {
        lines.push('');
        lines.push('--- stdout ---');
        lines.push(finalResult.stdout.slice(0, 2000));
      }
      if (finalResult.stderr) {
        lines.push('');
        lines.push('--- stderr ---');
        lines.push(finalResult.stderr.slice(0, 1000));
      }

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
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

  // Register decompose_task tool
  server.tool(
    'decompose_task',
    'Analyze a complex task and decompose it into subtasks with routing recommendations',
    {
      taskDescription: z.string().describe('The task description to analyze and decompose'),
    },
    async (params) => {
      const result = await handleDecomposeTask(params);

      const lines: string[] = [];
      if (!result.shouldDecompose) {
        lines.push(`[agent-mux] No decomposition needed: ${result.reason}`);
      } else {
        lines.push(`[agent-mux] ═══ Task Decomposition ═══`);
        lines.push(`  Strategy: ${result.executionStrategy}`);
        lines.push(`  Reason: ${result.reason}`);
        lines.push(`  Subtasks: ${result.subtasks.length}`);
        lines.push('');
        for (const st of result.subtasks) {
          lines.push(`  [${st.id}] ${st.description}`);
          lines.push(`      Target: ${st.recommendedTarget}  |  Files: ~${st.estimatedFiles}  |  Priority: ${st.priority}`);
          lines.push(`      Dependencies: ${st.dependencies.length > 0 ? st.dependencies.join(', ') : 'none'}`);
          lines.push('');
        }
        lines.push(`═══════════════════════════════`);
      }

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
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
