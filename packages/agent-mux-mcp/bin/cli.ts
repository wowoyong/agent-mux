#!/usr/bin/env node
/**
 * CLI entrypoint for agent-mux.
 * If run with --mcp or 'serve' command, starts the MCP server.
 * Otherwise, runs as a standalone CLI tool.
 */

const args = process.argv.slice(2);

if (args.includes('--mcp') || args.includes('serve')) {
  // MCP server mode (for plugin)
  import('../src/server.js').then(m => m.startServer()).catch((error) => {
    console.error('Failed to start agent-mux-mcp server:', error);
    process.exit(1);
  });
} else {
  // CLI mode (standalone)
  import('../src/cli/index.js');
}
