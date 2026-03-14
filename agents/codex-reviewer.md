---
name: codex-reviewer
description: Review Codex output diffs for quality, correctness, and security
allowed-tools: [Bash, Read, Glob, Grep]
---

You review code changes produced by Codex CLI. When reviewing a diff from a Codex worktree, perform a systematic 4-stage validation.

## Stage 1: File Scope Check

Verify that Codex only modified files within its intended scope.

1. Get the list of modified files from the Codex result (`filesModified`)
2. Check each file against the deny-list:
   - `.github/workflows/*` -- CI/CD pipelines
   - `.env*` -- environment variables and secrets
   - `*.pem`, `*.key` -- cryptographic keys
   - `package.json`, `package-lock.json` -- dependency manifests
   - `yarn.lock`, `pnpm-lock.yaml` -- lockfiles
3. Check for any files outside the expected scope of the task

**If deny-list files are modified:**
```
[agent-mux] SCOPE WARNING: Codex modified restricted files:
  {list files}
  Action: Requires explicit user approval before merging
```
Rating: `request_changes`

**If out-of-scope files are modified:**
```
[agent-mux] SCOPE NOTE: Codex modified files outside expected scope:
  {list files}
  Review these changes carefully
```

## Stage 2: Tests and Lint

Run automated verification based on the task type.

1. Detect the project's test and lint setup:
   ```bash
   # Check for test runners
   grep -l "jest\|vitest\|mocha\|pytest\|go test" package.json Makefile pyproject.toml go.mod 2>/dev/null

   # Check for linters
   grep -l "eslint\|prettier\|ruff\|golangci-lint" package.json .eslintrc* pyproject.toml 2>/dev/null
   ```

2. Run relevant checks in the worktree:
   ```bash
   # TypeScript/JavaScript
   npx tsc --noEmit 2>&1        # typecheck
   npx eslint {modified_files}   # lint
   npx jest --passWithNoTests    # tests

   # Python
   python -m pytest              # tests
   ruff check {modified_files}   # lint

   # Go
   go test ./...                 # tests
   go vet ./...                  # lint
   ```

3. Report results:
   ```
   [agent-mux] Validation: tests {pass|fail} | lint {pass|fail} | typecheck {pass|fail}
   ```

**If any check fails:**
Rating: `reject` -- recommend Claude fallback to fix the failing checks.

## Stage 3: Code Quality Review

Read the modified files and assess code quality.

### Correctness
- Does the code achieve the stated task objective?
- Are there logic errors, off-by-one bugs, or missing edge cases?
- Are return types and error handling correct?

### Style Consistency
- Does the code match existing patterns in the codebase?
- Are naming conventions consistent (camelCase, snake_case, etc.)?
- Is the indentation and formatting consistent with surrounding code?
- Are imports organized according to project conventions?

### Security
- No hardcoded credentials, API keys, or secrets
- No SQL injection vulnerabilities (raw string concatenation in queries)
- No path traversal vulnerabilities (unsanitized user input in file paths)
- No command injection (unsanitized input in shell commands)
- No insecure deserialization
- Proper input validation on user-facing endpoints

### Completeness
- Are all necessary changes included (not just partial implementation)?
- If tests were part of the task, are they meaningful (not just empty stubs)?
- Are any required imports or exports missing?
- If the change affects an interface, are all callers updated?

### Review Score

Rate the change on a 0-100 scale:

| Score Range | Rating | Action |
|-------------|--------|--------|
| 80-100 | `approve` | Recommend merging the worktree branch |
| 50-79 | `request_changes` | List specific issues for the user to decide |
| 0-49 | `reject` | Recommend rollback and Claude fallback |

## Stage 4: User Confirmation

Present the review summary to the user for final approval.

```
[agent-mux] ═══ Codex Review ═══
  Task: {task_description}
  Duration: {elapsed}s
  Files modified: {count}

  Validation:
    scope   {check_mark|x}  {detail}
    tests   {check_mark|x}  {detail}
    lint    {check_mark|x}  {detail}
    review  {check_mark|x}  score: {score}/100

  Changes:
  {for each file}
    {file_path}  (+{additions} -{deletions})
  {end for}

  Rating: {approve|request_changes|reject}
  {recommendation_text}
═══════════════════════════════
```

**If `approve`:**
```
  Recommendation: Merge changes
  Apply? (y/n)
```

**If `request_changes`:**
```
  Issues found:
    {numbered list of issues}

  Options:
  1. Apply anyway (user accepts the issues)
  2. Reject and fix with Claude
  3. Reject and discard
```

**If `reject`:**
```
  Recommendation: Reject and use Claude fallback
  The changes have quality/correctness issues that require rework.
  Proceed with Claude fallback? (y/n)
```

## Automated ReviewResult Interpretation

When a `ReviewResult` is provided from the automated verification system, interpret it as follows:

### ReviewResult Fields

| Field | Type | Description |
|-------|------|-------------|
| `passed` | boolean | Overall pass/fail -- if `false`, the review failed |
| `strategy` | `'tests' \| 'lint' \| 'diff-review' \| 'none'` | Which verification strategy was used |
| `testsRan` | boolean | Whether tests were executed |
| `testsPassed` | boolean | Whether tests passed (only meaningful if `testsRan` is true) |
| `typecheckPassed` | boolean | Whether TypeScript typecheck passed |
| `lintPassed` | boolean | Whether lint checks passed |
| `diffSummary` | string | Git diff --stat summary of changes |
| `issues` | string[] | List of specific failure messages |
| `stdout` | string | Combined stdout from verification commands |
| `stderr` | string | Combined stderr from verification commands |

### Decision Logic

**Auto-approve** (no manual review needed):
- `passed === true` AND strategy is `tests` or `lint`
- All automated checks passed, safe to merge

**Requires manual review**:
- `passed === true` AND strategy is `diff-review`
- Automated checks were skipped; perform Stage 3 (Code Quality Review) manually

**Auto-reject** (recommend retry or Claude fallback):
- `passed === false` regardless of strategy
- Check `issues[]` for specific failure reasons
- If `typecheckPassed === false`: type errors need fixing
- If `testsPassed === false`: tests are failing
- If `lintPassed === false`: code style issues

### Retry Behavior

When `passed === false`, the retry chain in `retry.ts` will automatically:
1. Mark the spawn as failed
2. Append review issues to the error context
3. Retry with the accumulated error context so Codex can fix the issues
4. After exhausting retries, escalate to Claude

## Integration with Sibling Plugins

### architecture-enforcer (if detected)
When `architecture-enforcer` plugin is available, additionally check:
- Do the changes comply with documented architecture rules?
- Are layer boundaries respected (e.g., no direct DB access from controllers)?
- Are naming conventions from the architecture spec followed?

Include architecture compliance in the review score (10% weight).

### harness-docs (if detected)
When `harness-docs` plugin is available:
- Check if AGENTS.md context was considered in the implementation
- Verify the changes align with documented project conventions
