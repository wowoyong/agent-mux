# Marketplace Repository Structure for wowoyong/agent-mux

## How Claude Code Plugin Marketplaces Work

Claude Code discovers plugins through marketplace repositories. A marketplace is a git repo containing a `marketplace.json` manifest that lists available plugins with their metadata and source paths.

### Current Known Marketplaces

Marketplaces are registered in `~/.claude/plugins/known_marketplaces.json`. Each entry has:

```json
{
  "marketplace-name": {
    "source": {
      "source": "github",
      "repo": "owner/repo"
    },
    "installLocation": "~/.claude/plugins/marketplaces/marketplace-name",
    "lastUpdated": "ISO-date"
  }
}
```

### Required File: `.claude-plugin/marketplace.json`

Every marketplace repo needs a `.claude-plugin/marketplace.json` file:

```json
{
  "name": "wowoyong",
  "owner": {
    "name": "Jo Jaeyong",
    "url": "https://github.com/wowoyong"
  },
  "metadata": {
    "description": "agent-mux: Multi-agent routing for Claude Code + Codex CLI",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "agent-mux",
      "description": "Routes coding tasks between Claude Code and Codex CLI based on complexity, optimizing AI subscription costs. Includes 4 commands, 2 skills, and an MCP server.",
      "version": "0.3.0",
      "author": {
        "name": "Jo Jaeyong",
        "url": "https://github.com/wowoyong"
      },
      "homepage": "https://github.com/wowoyong/agent-mux",
      "tags": [
        "multi-agent",
        "routing",
        "codex",
        "cost-optimization",
        "task-routing",
        "mcp-server"
      ],
      "source": "."
    }
  ]
}
```

### What agent-mux Already Has

The agent-mux repo already has the correct plugin structure:

```
agent-mux/
  .claude-plugin/          # Not present yet for marketplace — needs marketplace.json
  commands/                # /mux, /mux-setup, /mux-status, /mux-config
  skills/                  # Slash command implementations
  hooks/                   # Event hooks
  agents/                  # Agent definitions
  packages/
    agent-mux-mcp/         # MCP server package
```

### What Needs to Be Created

For `claude plugin add wowoyong/agent-mux` to work:

1. **Register as a marketplace** OR **register as a standalone plugin**

   **Option A: Standalone plugin** (simpler, recommended for single-plugin repos):
   - The repo already has commands, skills, hooks, and agents
   - Users install with: `claude plugin add wowoyong/agent-mux`
   - Claude Code clones the repo and reads the plugin structure directly
   - Requires a `plugin.json` or `.claude-plugin/` manifest at the root

   **Option B: Marketplace** (for hosting multiple plugins):
   - Create `.claude-plugin/marketplace.json` as shown above
   - Each plugin entry has a `source` path pointing to the plugin directory
   - Users browse with: `claude plugin search agent-mux`

2. **Current status**: The repo already has `plugin.json` at the root, so standalone installation should work. No additional marketplace structure is needed unless we want to host multiple plugins.

### Testing Installation

```bash
# Install the plugin directly
claude plugin add wowoyong/agent-mux

# Verify it's installed
claude plugin list

# Test a command
/mux --dry-run "write tests for utils"
```

### Future: Creating a wowoyong Marketplace

If more plugins are added later, create a dedicated marketplace repo:

```bash
# Create marketplace repo
gh repo create wowoyong/claude-plugins --public

# Structure:
# wowoyong/claude-plugins/
#   .claude-plugin/marketplace.json
#   plugins/
#     agent-mux/  (git submodule or copy)
#     future-plugin/
```

Then register it:
```bash
claude marketplace add wowoyong/claude-plugins
```
