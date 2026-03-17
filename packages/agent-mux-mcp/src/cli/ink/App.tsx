/**
 * App — Full TUI application root.
 * Wires engine, message state, budget, input, and streaming area together.
 */

import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { Header } from "./components/Header.js";
import { InputBar } from "./components/InputBar.js";
import { UserMessage } from "./components/UserMessage.js";
import { AssistantMessage } from "./components/AssistantMessage.js";
import { StreamingArea } from "./components/StreamingArea.js";
import { useEngine } from "./hooks/useEngine.js";
import { useMessages } from "./hooks/useMessages.js";
import { useBudget } from "./hooks/useBudget.js";
import type { MuxConfig } from "../../types.js";

// ─── Slash command help text ─────────────────────────────────────────

const HELP_TEXT = `
Available commands:
  /quit          Exit agent-mux
  /help          Show this help
  /status        Show budget and routing status
  /history       Show recent routing history
  /why           Explain last routing decision
  /config        Show current configuration
  /go <task>     Force route to Codex
  /chat <msg>    Force route to Claude (chat mode)
`.trim();

// ─── App component ───────────────────────────────────────────────────

export function App(): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const engine = useEngine();
  const { messages, streamBuffer, currentMessage, appState, handleEvent, addUserMessage, reset } = useMessages();
  const { budget, handleBudgetEvent } = useBudget(engine);

  const [config, setConfig] = useState<MuxConfig | null>(null);
  const [version, setVersion] = useState<string>("…");
  const [statusLine, setStatusLine] = useState<string>("");

  // Last routing decision for /why command
  const lastDecisionRef = useRef<string>("");

  // Track Ctrl+C double-press timing
  const lastCtrlCRef = useRef<number>(0);

  // ─── Load config + version on mount ────────────────────────────────

  useEffect(() => {
    if (!engine) return;
    void engine.getConfig().then(setConfig);
    setVersion(engine.getVersion());
  }, [engine]);

  // ─── Terminal width warning ─────────────────────────────────────────

  const termWidth = stdout?.columns ?? 80;
  const narrowWarning = termWidth < 60
    ? `Terminal width ${termWidth} columns is too narrow (min 60). Please resize.`
    : null;

  // ─── Ctrl+C handling ────────────────────────────────────────────────
  // Double Ctrl+C (within 500ms) exits; single Ctrl+C cancels current task.

  useInput((_input, key) => {
    if (key.ctrl && _input === "c") {
      const now = Date.now();
      if (now - lastCtrlCRef.current < 500) {
        exit();
        return;
      }
      lastCtrlCRef.current = now;
      if (appState !== "idle") {
        engine?.cancel();
        reset();
        setStatusLine("Task cancelled. Press Ctrl+C again within 0.5s to quit.");
      } else {
        setStatusLine("Press Ctrl+C again within 0.5s to quit.");
      }
    }
  });

  // ─── Confirm response handler ───────────────────────────────────────

  const handleConfirm = (confirmId: string, choice: string) => {
    engine?.respondToConfirm(confirmId, choice);
    // The streaming generator will resume after this call.
    // Update state to reflect streaming again (generator may emit more events).
  };

  // ─── Submit handler ─────────────────────────────────────────────────

  const handleSubmit = async (input: string): Promise<void> => {
    const trimmed = input.trim();
    if (!trimmed || !engine) return;

    setStatusLine("");

    // ── Slash commands ─────────────────────────────────────────────────

    if (trimmed === "/quit") {
      exit();
      return;
    }

    if (trimmed === "/help") {
      setStatusLine(HELP_TEXT);
      return;
    }

    if (trimmed === "/status") {
      try {
        const b = await engine.getBudget();
        const pct = (n: number) => `${n.toFixed(0)}%`;
        setStatusLine(
          `Claude: ${pct(b.claude.usagePercent)} used (${b.claude.tasksCompleted} tasks) | ` +
          `Codex: ${pct(b.codex.usagePercent)} used (${b.codex.tasksCompleted} tasks) | ` +
          `Bias: ${b.currentBias}`
        );
      } catch (err) {
        setStatusLine("Failed to load budget status.");
      }
      return;
    }

    if (trimmed === "/history") {
      try {
        const history = await engine.getHistory(10);
        if (history.length === 0) {
          setStatusLine("No routing history.");
          return;
        }
        const lines = history.map((h) =>
          `${new Date(h.timestamp).toLocaleTimeString()} → ${h.decision.target} (${(h.decision.confidence * 100).toFixed(0)}%) — ${h.taskSummary.slice(0, 60)}`
        );
        setStatusLine(lines.join("\n"));
      } catch {
        setStatusLine("Failed to load routing history.");
      }
      return;
    }

    if (trimmed === "/why") {
      setStatusLine(lastDecisionRef.current || "No routing decision recorded yet.");
      return;
    }

    if (trimmed === "/config") {
      if (!config) {
        setStatusLine("Config not loaded yet.");
        return;
      }
      setStatusLine(
        `Tier: ${config.tier} | Engine: ${config.routing.engine} | ` +
        `Bias: ${config.routing.bias} | ` +
        `Claude: ${config.routing.split.claude}% / Codex: ${config.routing.split.codex}%`
      );
      return;
    }

    // /go <task> — force Codex
    if (trimmed.startsWith("/go ")) {
      const task = trimmed.slice(4).trim();
      if (!task) {
        setStatusLine("Usage: /go <task description>");
        return;
      }
      addUserMessage(`/go ${task}`);
      try {
        const decision = await engine.analyzeAndRoute(task, { route: "codex" });
        lastDecisionRef.current = `Routed to ${decision.target}: ${decision.reason}`;
        handleEvent({ type: "routing", decision });
        for await (const event of engine.execute(task, decision)) {
          handleEvent(event);
          handleBudgetEvent(event);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        handleEvent({ type: 'error', message: msg, recoverable: true });
        reset();
      }
      return;
    }

    // /chat <msg> — force Claude chat
    if (trimmed.startsWith("/chat ")) {
      const chatInput = trimmed.slice(6).trim();
      if (!chatInput) {
        setStatusLine("Usage: /chat <message>");
        return;
      }
      addUserMessage(chatInput);
      try {
        for await (const event of engine.chat(chatInput)) {
          handleEvent(event);
          handleBudgetEvent(event);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        handleEvent({ type: 'error', message: msg, recoverable: true });
        reset();
      }
      return;
    }

    // ── Normal task routing ─────────────────────────────────────────────

    addUserMessage(trimmed);

    try {
      if (engine.isCodingTask(trimmed)) {
        const decision = await engine.analyzeAndRoute(trimmed);
        lastDecisionRef.current = `Routed to ${decision.target} (${(decision.confidence * 100).toFixed(0)}%): ${decision.reason}`;
        for await (const event of engine.execute(trimmed, decision)) {
          handleEvent(event);
          handleBudgetEvent(event);
        }
      } else {
        for await (const event of engine.chat(trimmed)) {
          handleEvent(event);
          handleBudgetEvent(event);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      handleEvent({ type: 'error', message: msg, recoverable: true });
      reset();
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────

  const isDisabled = appState !== "idle";

  return (
    <Box flexDirection="column" height="100%">
      {/* Header — always visible */}
      {config && budget && (
        <Header version={version} config={config} budget={budget} />
      )}

      {/* Narrow terminal warning */}
      {narrowWarning && (
        <Box paddingX={1}>
          <Text color="yellow">{narrowWarning}</Text>
        </Box>
      )}

      {/* Message history (static, completed messages) */}
      <Box flexDirection="column" flexGrow={1}>
        {messages.map((msg) =>
          msg.role === "user" ? (
            <UserMessage key={msg.id} content={msg.content} />
          ) : msg.role === "assistant" ? (
            <AssistantMessage key={msg.id} content={msg.content} />
          ) : (
            <Box key={msg.id} paddingX={1}>
              <Text dimColor>{msg.content}</Text>
            </Box>
          )
        )}

        {/* Active streaming area */}
        <StreamingArea
          streamBuffer={streamBuffer}
          currentMessage={currentMessage}
          appState={appState}
        />
      </Box>

      {/* Status line */}
      {statusLine && (
        <Box paddingX={1} flexDirection="column">
          {statusLine.split("\n").map((line, i) => (
            <Text key={i} dimColor>{line}</Text>
          ))}
        </Box>
      )}

      {/* Confirm input shortcut hint */}
      {appState === "confirming" && currentMessage.confirm && (
        <Box paddingX={1}>
          <Text color="yellow">
            Type yes/no/review to confirm, then press Enter:
          </Text>
        </Box>
      )}

      {/* Input bar */}
      <InputBar
        onSubmit={(input) => {
          // If confirming, intercept and route to confirm handler
          if (appState === "confirming" && currentMessage.confirm) {
            const choice = input.trim().toLowerCase();
            handleConfirm(currentMessage.confirm.id, choice);
            return;
          }
          void handleSubmit(input);
        }}
        isDisabled={isDisabled && appState !== "confirming"}
        statusText={
          appState === "streaming"
            ? "Processing…"
            : appState === "confirming"
            ? "Awaiting confirmation…"
            : undefined
        }
      />
    </Box>
  );
}
