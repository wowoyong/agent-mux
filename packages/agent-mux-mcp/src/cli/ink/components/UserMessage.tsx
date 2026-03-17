/**
 * UserMessage component — Simple user message display.
 */

import React from "react";
import { Box, Text } from "ink";

interface UserMessageProps {
  content: string;
}

export function UserMessage({ content }: UserMessageProps): React.ReactElement {
  return (
    <Box flexDirection="row" gap={1}>
      <Text bold color="cyan">You</Text>
      <Text>{content}</Text>
    </Box>
  );
}
