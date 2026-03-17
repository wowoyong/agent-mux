/**
 * StreamingArea component — Active response area that re-renders during streaming.
 * NOTE: marked is imported here but NOT configured — configuration happens in AssistantMessage.
 */

import React from "react";
import { Box, Text } from "ink";
import { marked } from "marked";
import { RoutingBadge } from "./RoutingBadge.js";
import { ThinkingBlock } from "./ThinkingBlock.js";
import { ToolUseBlock } from "./ToolUseBlock.js";
import { DiffPreview } from "./DiffPreview.js";
import { MuxSpinner } from "./MuxSpinner.js";
import type { RouteResult } from "../../../core/events.js";

interface ToolUse {
  tool: string;
  input: Record<string, unknown>;
  output?: string;
}

interface Message {
  routing?: RouteResult;
  toolUses?: ToolUse[];
  thinkingBlocks?: string[];
  diff?: { patch: string; files: string[] };
  confirm?: { id: string; prompt: string; options: string[] };
  progressText?: string;
}

interface StreamingAreaProps {
  streamBuffer: string;
  currentMessage: Partial<Message>;
  appState: "idle" | "streaming" | "confirming";
}

export function StreamingArea({
  streamBuffer,
  currentMessage,
  appState,
}: StreamingAreaProps): React.ReactElement | null {
  if (appState === "idle") return null;

  const isStreaming = appState === "streaming";
  const isConfirming = appState === "confirming";
  const hasContent = streamBuffer.length > 0;

  const rendered = hasContent ? String(marked.parse(streamBuffer)) : "";

  return (
    <Box flexDirection="column" gap={1}>
      {/* Routing badge */}
      {currentMessage.routing !== undefined && (
        <RoutingBadge decision={currentMessage.routing} />
      )}

      {/* Assistant label */}
      <Text bold color="green">Assistant</Text>

      {/* Thinking blocks */}
      {currentMessage.thinkingBlocks?.map((content, i) => (
        <ThinkingBlock key={i} content={content} />
      ))}

      {/* Tool use blocks */}
      {currentMessage.toolUses?.map((tu, i) => (
        <ToolUseBlock key={i} tool={tu.tool} input={tu.input} output={tu.output} />
      ))}

      {/* Diff preview */}
      {currentMessage.diff !== undefined && (
        <DiffPreview patch={currentMessage.diff.patch} files={currentMessage.diff.files} />
      )}

      {/* Streamed markdown content */}
      {hasContent && <Text>{rendered}</Text>}

      {/* Progress text */}
      {currentMessage.progressText !== undefined && (
        <Text dimColor>{currentMessage.progressText}</Text>
      )}

      {/* Spinner when streaming with no content yet */}
      {isStreaming && !hasContent && (
        <MuxSpinner label="Thinking…" />
      )}

      {/* Confirm prompt */}
      {isConfirming && currentMessage.confirm !== undefined && (
        <Box flexDirection="column" gap={1} borderStyle="round" borderColor="yellow" paddingX={1}>
          <Text bold color="yellow">Confirm</Text>
          <Text>{currentMessage.confirm.prompt}</Text>
          <Box flexDirection="row" gap={2}>
            {currentMessage.confirm.options.map((opt, i) => (
              <Text key={i} color="cyan">[{opt}]</Text>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
