/**
 * useMessages hook — Message state management for the TUI.
 * Uses refs to avoid stale closures in the event handler.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { MuxEvent, RouteResult } from "../../../core/events.js";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  routing?: RouteResult;
  toolUses?: Array<{ tool: string; input: Record<string, unknown>; output?: string }>;
  thinkingBlocks?: string[];
  diff?: { patch: string; files: string[] };
  fileList?: { files: string[]; additions: number; deletions: number };
  confirm?: { id: string; prompt: string; options: string[] };
  progressText?: string;
}

export type AppState = "idle" | "streaming" | "confirming";

interface UseMessagesReturn {
  messages: Message[];
  streamBuffer: string;
  currentMessage: Partial<Message>;
  appState: AppState;
  handleEvent: (event: MuxEvent) => void;
  addUserMessage: (content: string) => void;
  reset: () => void;
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useMessages(): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamBuffer, setStreamBuffer] = useState<string>("");
  const [currentMessage, setCurrentMessage] = useState<Partial<Message>>({});
  const [appState, setAppState] = useState<AppState>("idle");

  // Refs for mutable state — avoids stale closures in handleEvent
  const streamBufferRef = useRef<string>("");
  const currentMessageRef = useRef<Partial<Message>>({});
  const appStateRef = useRef<AppState>("idle");

  // Keep refs in sync with state
  useEffect(() => {
    streamBufferRef.current = streamBuffer;
  }, [streamBuffer]);

  useEffect(() => {
    currentMessageRef.current = currentMessage;
  }, [currentMessage]);

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  const addUserMessage = useCallback((content: string) => {
    const msg: Message = {
      id: generateId(),
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, msg]);
  }, []);

  const reset = useCallback(() => {
    setStreamBuffer("");
    setCurrentMessage({});
    setAppState("idle");
    streamBufferRef.current = "";
    currentMessageRef.current = {};
  }, []);

  // handleEvent has empty deps — uses refs for mutable state
  const handleEvent = useCallback((event: MuxEvent) => {
    switch (event.type) {
      case "routing": {
        setCurrentMessage((prev) => {
          const updated = { ...prev, routing: event.decision };
          currentMessageRef.current = updated;
          return updated;
        });
        setAppState("streaming");
        break;
      }

      case "stream": {
        setStreamBuffer((prev) => {
          const updated = prev + event.chunk;
          streamBufferRef.current = updated;
          return updated;
        });
        setAppState("streaming");
        break;
      }

      case "thinking": {
        setCurrentMessage((prev) => {
          const updated = {
            ...prev,
            thinkingBlocks: [...(prev.thinkingBlocks ?? []), event.content],
          };
          currentMessageRef.current = updated;
          return updated;
        });
        break;
      }

      case "tool_use": {
        setCurrentMessage((prev) => {
          const updated = {
            ...prev,
            toolUses: [
              ...(prev.toolUses ?? []),
              { tool: event.tool, input: event.input },
            ],
          };
          currentMessageRef.current = updated;
          return updated;
        });
        break;
      }

      case "tool_result": {
        setCurrentMessage((prev) => {
          const toolUses = prev.toolUses ?? [];
          // Attach result to the last tool use
          const updated = {
            ...prev,
            toolUses:
              toolUses.length > 0
                ? [
                    ...toolUses.slice(0, -1),
                    { ...toolUses[toolUses.length - 1], output: event.output },
                  ]
                : toolUses,
          };
          currentMessageRef.current = updated;
          return updated;
        });
        break;
      }

      case "diff": {
        setCurrentMessage((prev) => {
          const updated = {
            ...prev,
            diff: { patch: event.patch, files: event.files },
          };
          currentMessageRef.current = updated;
          return updated;
        });
        break;
      }

      case "file_list": {
        setCurrentMessage((prev) => {
          const updated = {
            ...prev,
            fileList: {
              files: event.files,
              additions: event.additions,
              deletions: event.deletions,
            },
          };
          currentMessageRef.current = updated;
          return updated;
        });
        break;
      }

      case "confirm": {
        setCurrentMessage((prev) => {
          const updated = {
            ...prev,
            confirm: { id: event.id, prompt: event.prompt, options: event.options },
          };
          currentMessageRef.current = updated;
          return updated;
        });
        setAppState("confirming");
        break;
      }

      case "progress": {
        setCurrentMessage((prev) => {
          const updated = { ...prev, progressText: event.message };
          currentMessageRef.current = updated;
          return updated;
        });
        if (appStateRef.current !== "confirming") {
          setAppState("streaming");
        }
        break;
      }

      case "error": {
        // Add error as a system message and reset streaming state
        const errMsg: Message = {
          id: generateId(),
          role: "system",
          content: `Error: ${event.message}`,
        };
        setMessages((prev) => [...prev, errMsg]);
        reset();
        break;
      }

      case "done": {
        // Finalize the current streaming message and move it to history
        const finalContent = streamBufferRef.current;
        const finalCurrent = currentMessageRef.current;

        const completedMsg: Message = {
          id: generateId(),
          role: "assistant",
          content: finalContent || event.summary,
          routing: finalCurrent.routing,
          toolUses: finalCurrent.toolUses,
          thinkingBlocks: finalCurrent.thinkingBlocks,
          diff: finalCurrent.diff,
          fileList: finalCurrent.fileList,
        };
        setMessages((prev) => [...prev, completedMsg]);
        reset();
        break;
      }

      case "budget_update": {
        // Budget updates are handled by useBudget hook — nothing to do here.
        break;
      }

      default: {
        // Exhaustive check — TypeScript will error if a MuxEvent type is unhandled
        const _exhaustive: never = event;
        void _exhaustive;
        break;
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    messages,
    streamBuffer,
    currentMessage,
    appState,
    handleEvent,
    addUserMessage,
    reset,
  };
}
