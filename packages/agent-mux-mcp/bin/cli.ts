#!/usr/bin/env node
/**
 * CLI entrypoint for agent-mux-mcp server.
 * Starts the MCP server using stdio transport.
 */

import { startServer } from '../src/server.js';

startServer().catch((error) => {
  console.error('Failed to start agent-mux-mcp server:', error);
  process.exit(1);
});
