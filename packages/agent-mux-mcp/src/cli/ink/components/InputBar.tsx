/**
 * InputBar component — Text input with slash command autocomplete.
 */

import React from "react";
import { Box, Text } from "ink";
import { TextInput } from "@inkjs/ui";

interface InputBarProps {
  onSubmit: (input: string) => void;
  isDisabled?: boolean;
  statusText?: string;
}

const SLASH_COMMANDS = [
  "/status",
  "/go",
  "/chat",
  "/history",
  "/why",
  "/config",
  "/help",
  "/quit",
];

export function InputBar({ onSubmit, isDisabled = false, statusText }: InputBarProps): React.ReactElement {
  return (
    <Box
      borderStyle="round"
      borderColor={isDisabled ? "gray" : "blue"}
      paddingX={1}
      flexDirection="row"
      gap={1}
    >
      <Text color={isDisabled ? "gray" : "blue"}>{">"}</Text>
      {isDisabled ? (
        <Text dimColor>{statusText ?? "Processing…"}</Text>
      ) : (
        <TextInput
          placeholder="Type a message or /command…"
          suggestions={SLASH_COMMANDS}
          onSubmit={onSubmit}
        />
      )}
    </Box>
  );
}
