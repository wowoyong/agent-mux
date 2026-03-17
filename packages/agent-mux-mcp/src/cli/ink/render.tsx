/**
 * render — Ink entry point for the TUI REPL.
 * Called when mux is run interactively (no task argument, TTY detected).
 */

import React from "react";
import { render } from "ink";
import { App } from "./App.js";

export async function startInkRepl(): Promise<void> {
  const instance = render(<App />, {
    exitOnCtrlC: false,   // We handle Ctrl+C ourselves in App.tsx
    patchConsole: true,   // Capture console.log so it doesn't break layout
  });

  await instance.waitUntilExit();
}
