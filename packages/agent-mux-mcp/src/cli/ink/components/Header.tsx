/**
 * Header component — Budget bar + tier info.
 * Always displayed at the top of the TUI.
 */

import React from "react";
import { Box, Text } from "ink";
import type { MuxConfig, BudgetStatus } from "../../../types.js";

interface HeaderProps {
  version: string;
  config: MuxConfig;
  budget: BudgetStatus;
}

function makeProgressBar(percent: number, width = 10): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}

function barColor(percent: number): "green" | "yellow" | "red" {
  if (percent >= 90) return "red";
  if (percent >= 75) return "yellow";
  return "green";
}

export function Header({ version, config, budget }: HeaderProps): React.ReactElement {
  const claudePct = Math.round(budget.claude.usagePercent);
  const codexPct = Math.round(budget.codex.usagePercent);
  const totalCost = config.claude.cost + config.codex.cost;

  return (
    <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column">
      <Text>
        <Text bold color="cyan">agent-mux</Text>
        <Text dimColor> v{version}</Text>
        <Text dimColor> | </Text>
        <Text>{config.tier}</Text>
        <Text dimColor> (${totalCost}/mo)</Text>
      </Text>
      <Text>
        <Text dimColor>Claude </Text>
        <Text color={barColor(claudePct)}>{makeProgressBar(claudePct)}</Text>
        <Text dimColor> {String(claudePct).padStart(3)}%  </Text>
        <Text dimColor>Codex </Text>
        <Text color={barColor(codexPct)}>{makeProgressBar(codexPct)}</Text>
        <Text dimColor> {String(codexPct).padStart(3)}%</Text>
      </Text>
    </Box>
  );
}
