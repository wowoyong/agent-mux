#!/bin/bash
# agent-mux session start hook
# Detects Codex CLI installation and sibling plugins

CODEX_INSTALLED="false"
CODEX_VERSION=""

if command -v codex &> /dev/null; then
  CODEX_INSTALLED="true"
  CODEX_VERSION=$(codex --version 2>/dev/null | head -1)
fi

# Check for sibling plugins
PLUGINS_FOUND=""
PLUGIN_BASE="$HOME/.claude/plugins/cache/wowoyong"
for plugin in harness-planner architecture-enforcer harness-docs; do
  if [ -d "$PLUGIN_BASE/$plugin" ]; then
    PLUGINS_FOUND="$PLUGINS_FOUND $plugin"
  fi
done

# Output as hook context
echo "{\"hookSpecificOutput\": {\"additionalContext\": \"[agent-mux] Codex CLI: ${CODEX_INSTALLED} (${CODEX_VERSION}). Detected plugins:${PLUGINS_FOUND:- none}\"}}"
