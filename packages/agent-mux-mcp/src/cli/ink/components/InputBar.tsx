/**
 * InputBar component — Text input with slash command autocomplete.
 * Clears input after submit by remounting TextInput via key change.
 */

import React, { useState, useCallback } from "react";
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
  // Increment key to force TextInput remount (clears input)
  const [inputKey, setInputKey] = useState(0);

  const handleSubmit = useCallback((value: string) => {
    onSubmit(value);
    setInputKey((k) => k + 1);
  }, [onSubmit]);

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
          key={inputKey}
          placeholder="Type a message or /command…"
          suggestions={SLASH_COMMANDS}
          onSubmit={handleSubmit}
        />
      )}
    </Box>
  );
}
