# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-03-14

### Added
- 197 unit tests across 6 test suites
- /mux-setup interactive wizard
- Plugin.json verification and author field

## [0.2.0] - 2026-03-14

### Added
- Retry chain with Claude fallback escalation
- JSONL-based budget persistence (~/.agent-mux/usage/)
- Budget warning system (50/75/90% thresholds)
- codex-reviewer with test/lint/diff-review verification
- Routing history and override learning
- Task decomposer with fan-out strategy
- decompose_task MCP tool
- /mux-status detailed dashboard

## [0.1.0] - 2026-03-14

### Added
- Initial release
- 2-phase routing engine (20 signals, 7 hard rules)
- Local 0-token keyword routing
- Codex CLI spawner with git worktree isolation
- JSONL event stream parser with stall detection
- 23-pattern file deny-list
- MCP server (spawn_codex, check_budget, get_mux_status)
- 4-tier support (Budget $40, Standard $120, Premium $220, Power $400)
- Plugin prompts (SKILL.md, 4 commands, 4 agents, hooks)
- Korean + English README
