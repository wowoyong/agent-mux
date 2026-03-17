/**
 * DiffPreview component — Colored unified diff display.
 */

import React from "react";
import { Box, Text } from "ink";

interface DiffPreviewProps {
  patch: string;
  files: string[];
  maxLines?: number;
}

type LineColor = "green" | "red" | "cyan" | undefined;

function lineColor(line: string): LineColor {
  if (line.startsWith("+")) return "green";
  if (line.startsWith("-")) return "red";
  if (line.startsWith("@@")) return "cyan";
  return undefined;
}

function isDim(line: string): boolean {
  return !line.startsWith("+") && !line.startsWith("-") && !line.startsWith("@@");
}

export function DiffPreview({ patch, files, maxLines = 200 }: DiffPreviewProps): React.ReactElement {
  const lines = patch.split("\n").slice(0, maxLines);

  return (
    <Box borderStyle="single" borderColor="gray" flexDirection="column" paddingX={1}>
      {files.length > 0 && (
        <Box marginBottom={1}>
          <Text bold color="white">{files.join(", ")}</Text>
        </Box>
      )}
      {lines.map((line, i) => {
        const color = lineColor(line);
        const dim = isDim(line);
        return (
          <Text key={i} color={color} dimColor={dim}>
            {line}
          </Text>
        );
      })}
    </Box>
  );
}
