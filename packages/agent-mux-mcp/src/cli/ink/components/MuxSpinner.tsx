/**
 * MuxSpinner component — Braille dot spinner.
 */

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

interface MuxSpinnerProps {
  label?: string;
}

const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INTERVAL_MS = 80;

export function MuxSpinner({ label }: MuxSpinnerProps): React.ReactElement {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % BRAILLE_FRAMES.length);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box flexDirection="row" gap={1}>
      <Text dimColor>{BRAILLE_FRAMES[frame]}</Text>
      {label !== undefined && <Text dimColor>{label}</Text>}
    </Box>
  );
}
