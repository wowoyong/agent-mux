/**
 * AssistantMessage component — Markdown-rendered assistant message.
 * Configures marked with markedTerminal at module level.
 */

import React from "react";
import { Box, Text } from "ink";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

// Configure marked once at module level
marked.use(
  markedTerminal({
    width: 80,
    reflowText: false,
    showSectionPrefix: false,
    tab: 2,
  })
);

interface AssistantMessageProps {
  content: string;
}

export function AssistantMessage({ content }: AssistantMessageProps): React.ReactElement {
  const rendered = String(marked.parse(content));

  return (
    <Box flexDirection="column">
      <Text bold color="green">Assistant</Text>
      <Text>{rendered}</Text>
    </Box>
  );
}
