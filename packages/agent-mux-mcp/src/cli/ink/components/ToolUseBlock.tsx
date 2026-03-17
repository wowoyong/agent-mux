/**
 * ToolUseBlock component — Collapsible tool use display.
 */

import React, { useState } from "react";
import { Box, Text, useInput, useFocus } from "ink";

interface ToolUseBlockProps {
  tool: string;
  input: Record<string, unknown>;
  output?: string;
}

export function ToolUseBlock({ tool, input, output }: ToolUseBlockProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const { isFocused } = useFocus();

  useInput(
    (_, key) => {
      if (key.return) {
        setExpanded((prev) => !prev);
      }
    },
    { isActive: isFocused }
  );

  // Derive a short label from the input
  const firstValue = Object.values(input)[0];
  const inputLabel =
    typeof firstValue === "string" ? firstValue : JSON.stringify(input).slice(0, 40);

  const arrow = expanded ? "\u25bc" : "\u25b6";

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text color={isFocused ? "cyan" : "yellow"}>{arrow}</Text>
        <Text color="yellow">{tool}</Text>
        <Text dimColor>{inputLabel}</Text>
      </Box>
      {expanded && (
        <Box flexDirection="column" marginLeft={2}>
          <Box flexDirection="column" marginBottom={1}>
            <Text dimColor bold>Input:</Text>
            <Text dimColor>{JSON.stringify(input, null, 2)}</Text>
          </Box>
          {output !== undefined && (
            <Box flexDirection="column">
              <Text dimColor bold>Output:</Text>
              <Text dimColor>{output}</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
