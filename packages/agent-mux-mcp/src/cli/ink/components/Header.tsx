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
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}

function barColor(percent: number): "green" | "yellow" | "red" {
  if (percent >= 90) return "red";
  if (percent >= 75) return "yellow";
  return "green";
}

export function Header({ version, config, budget }: HeaderProps): React.ReactElement {
  const claudePct = budget.claude.usagePercent;
  const codexPct = budget.codex.usagePercent;
  const claudeBar = makeProgressBar(claudePct);
  const codexBar = makeProgressBar(codexPct);
  const totalCost = (budget.claude.monthlyCost + budget.codex.monthlyCost).toFixed(2);

  return (
    <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="row" justifyContent="space-between">
      <Box flexDirection="row" gap={1}>
        <Text bold color="cyan">agent-mux</Text>
        <Text dimColor>v{version}</Text>
        <Text dimColor>|</Text>
        <Text color="white">{config.tier}</Text>
      </Box>
      <Box flexDirection="row" gap={2}>
        <Box flexDirection="row" gap={1}>
          <Text dimColor>Claude</Text>
          <Text color={barColor(claudePct)}>{claudeBar}</Text>
          <Text color={barColor(claudePct)}>{claudePct.toFixed(0)}%</Text>
        </Box>
        <Box flexDirection="row" gap={1}>
          <Text dimColor>Codex</Text>
          <Text color={barColor(codexPct)}>{codexBar}</Text>
          <Text color={barColor(codexPct)}>{codexPct.toFixed(0)}%</Text>
        </Box>
        <Text dimColor>${totalCost}/mo</Text>
      </Box>
    </Box>
  );
}
