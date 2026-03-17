/**
 * RoutingBadge component — Routing decision display.
 */

import React from "react";
import { Box, Text } from "ink";
import type { RouteResult } from "../../../core/events.js";

interface RoutingBadgeProps {
  decision: RouteResult;
}

export function RoutingBadge({ decision }: RoutingBadgeProps): React.ReactElement {
  const isClaude = decision.target === "claude";
  const targetColor = isClaude ? "blue" : "green";
  const targetLabel = isClaude ? "Claude" : "Codex";
  const confidencePct = Math.round(decision.confidence * 100);

  return (
    <Box flexDirection="row" gap={1}>
      <Text dimColor>{"→"}</Text>
      <Text bold color={targetColor}>{targetLabel}</Text>
      <Text dimColor>{decision.reason}</Text>
      <Text color={targetColor}>{confidencePct}%</Text>
    </Box>
  );
}
