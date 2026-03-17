/**
 * useBudget hook — Polls budget every 30s and updates on budget_update events.
 */

import { useState, useEffect, useCallback } from "react";
import type { MuxEngine } from "../../../core/engine.js";
import type { MuxEvent } from "../../../core/events.js";
import type { BudgetStatus } from "../../../types.js";

const POLL_INTERVAL_MS = 30_000;

interface UseBudgetReturn {
  budget: BudgetStatus | null;
  handleBudgetEvent: (event: MuxEvent) => void;
}

const DEFAULT_BUDGET: BudgetStatus = {
  claude: {
    agent: "claude",
    monthlyCost: 0,
    usagePercent: 0,
    tasksCompleted: 0,
    remainingCapacity: "high",
  },
  codex: {
    agent: "codex",
    monthlyCost: 0,
    usagePercent: 0,
    tasksCompleted: 0,
    remainingCapacity: "high",
  },
  currentBias: "balanced",
  activeWarnings: [],
  periodStart: new Date().toISOString(),
  periodEnd: new Date().toISOString(),
};

export function useBudget(engine: MuxEngine | null): UseBudgetReturn {
  const [budget, setBudget] = useState<BudgetStatus | null>(null);

  // Initial fetch + polling every 30s
  useEffect(() => {
    if (!engine) return;

    let cancelled = false;

    async function fetchBudget() {
      if (!engine || cancelled) return;
      try {
        const status = await engine.getBudget();
        if (!cancelled) setBudget(status);
      } catch {
        // On error, fall back to default so UI is never blank
        if (!cancelled) setBudget(DEFAULT_BUDGET);
      }
    }

    void fetchBudget();

    const interval = setInterval(fetchBudget, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [engine]);

  // Event-driven budget updates from the stream
  const handleBudgetEvent = useCallback((event: MuxEvent) => {
    if (event.type === "budget_update") {
      setBudget(event.budget);
    }
  }, []);

  return { budget, handleBudgetEvent };
}
