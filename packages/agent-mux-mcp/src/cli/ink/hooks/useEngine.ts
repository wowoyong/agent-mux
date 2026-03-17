/**
 * useEngine hook — Async-initializes and returns the MuxEngine singleton.
 * Returns null while the engine is being created.
 */

import { useState, useEffect } from "react";
import { createEngine } from "../../../core/engine.js";
import type { MuxEngine } from "../../../core/engine.js";

export function useEngine(): MuxEngine | null {
  const [engine, setEngine] = useState<MuxEngine | null>(null);

  useEffect(() => {
    createEngine().then(setEngine);
  }, []);

  return engine;
}
