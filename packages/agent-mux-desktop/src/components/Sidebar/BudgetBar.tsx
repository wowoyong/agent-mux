import { useAgentStore } from '../../stores/agentStore';

export function BudgetBar() {
  const budget = useAgentStore((s) => s.budget);

  const claudePercent = budget.claude.limit > 0
    ? Math.min((budget.claude.used / budget.claude.limit) * 100, 100)
    : 0;
  const codexPercent = budget.codex.limit > 0
    ? Math.min((budget.codex.used / budget.codex.limit) * 100, 100)
    : 0;

  return (
    <div className="px-3 py-2 space-y-1.5">
      <div>
        <div className="flex items-center justify-between text-[10px] text-[#737373] mb-0.5">
          <span>Claude</span>
          <span>{budget.claude.used}/{budget.claude.limit}</span>
        </div>
        <div className="h-1 w-full bg-[#262626] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#d97706] rounded-full transition-all duration-300"
            style={{ width: `${claudePercent}%` }}
          />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-[10px] text-[#737373] mb-0.5">
          <span>Codex</span>
          <span>{budget.codex.used}/{budget.codex.limit}</span>
        </div>
        <div className="h-1 w-full bg-[#262626] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#8b5cf6] rounded-full transition-all duration-300"
            style={{ width: `${codexPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
