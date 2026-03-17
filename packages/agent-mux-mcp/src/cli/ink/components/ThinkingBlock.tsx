/**
 * ThinkingBlock component — Collapsible thinking content.
 */

import React, { useState } from "react";
import { Box, Text, useInput, useFocus } from "ink";

interface ThinkingBlockProps {
  content: string;
}

const PREVIEW_LENGTH = 60;

export function ThinkingBlock({ content }: ThinkingBlockProps): React.ReactElement {
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

  const preview =
    content.length > PREVIEW_LENGTH
      ? content.slice(0, PREVIEW_LENGTH) + "…"
      : content;

  const arrow = expanded ? "\u25bc" : "\u25b6";

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text color={isFocused ? "cyan" : "magenta"}>{arrow}</Text>
        <Text dimColor italic>Thinking: {expanded ? "" : preview}</Text>
      </Box>
      {expanded && (
        <Box marginLeft={2}>
          <Text dimColor italic>{content}</Text>
        </Box>
      )}
    </Box>
  );
}
