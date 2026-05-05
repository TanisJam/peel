# Tasks: peel list + peel clean

> Strict TDD active. Real fs/git via `tmp-promise`. No mocks. `FakePrompter` is a fake (scripted), not a mock.

## Phase 1: worktree-filter (pure helpers)

- [x] 1.1 RED: `src/core/worktree-filter.test.ts` — `filterToolWorktrees` includes basename-matching tool worktrees, excludes repoRoot, excludes foreign paths, excludes detached-HEAD entries.
- [x] 1.2 GREEN: `src/core/worktree-filter.ts` — `filterToolWorktrees(all, {repoRoot, baseDir, repoName})`.
- [x] 1.3 RED: `getWorktreeStatus` cases — live PID → `running`; stale PID → `idle`; no lock → `idle`. Use real `tmp-promise` dir + write `peel.lock`. Live PID = `process.pid`.
- [x] 1.4 GREEN: `getWorktreeStatus(path)` using `process.kill(pid, 0)` (treat EPERM as alive, ESRCH as dead).
- [x] 1.5 RED: `getWorktreeAge` returns ms since `mtimeMs`; `formatAge` for 45s, 5m, 2h, 3d.
- [x] 1.6 GREEN: `getWorktreeAge`, `formatAge`.

## Phase 2: list-flow

- [x] 2.1 RED: `src/core/list-flow.test.ts` — happy path with 2 tool worktrees + main → returns 2 rows; main path absent.
- [x] 2.2 GREEN: `src/core/list-flow.ts` — `listFlow(deps)` composing loadConfig + listWorktrees + filter + status + age.
- [x] 2.3 RED: empty state — no tool worktrees → returns `{rows: []}`.
- [x] 2.4 RED: missing config → throws `ListFlowError(no-config)`. GREEN.
- [x] 2.5 RED: status reflects lock state per row.

## Phase 3: clean-flow — single

- [x] 3.1 RED: `src/core/clean-flow.test.ts` — `mode:single, branch:feature/x` removes tool worktree, returns `[{kind:"removed", branch}]`.
- [x] 3.2 GREEN: `src/core/clean-flow.ts` — single mode skeleton + `CleanFlowError`.
- [x] 3.3 RED: branch not in tool set → throws `CleanFlowError(branch-not-found)`. GREEN.
- [x] 3.4 RED: single-target running → outcome `removed` AND `runningWarning: true` in result. GREEN.

## Phase 4: clean-flow — bulk

- [x] 4.1 RED: `mode:all, yes:true`, 3 idle → 3 `removed` outcomes. GREEN.
- [x] 4.2 RED: `mode:all, yes:false`, prompter accepts → removes all. GREEN.
- [x] 4.3 RED: `mode:all, yes:false`, prompter declines → `cancelled:true`, no removals. GREEN.
- [x] 4.4 RED: bulk skip-running — 2 idle + 1 running → 2 `removed` + 1 `skipped-running`. GREEN.

## Phase 5: clean-flow — stale

- [x] 5.1 RED: `mode:stale, yes:true` — branch missing local+remote → removed. GREEN.
- [x] 5.2 RED: branch still exists → preserved. GREEN.
- [x] 5.3 RED: fetch failure with `noFetch:false` → warning logged, staleness uses local view, command exits 0. GREEN.
- [x] 5.4 RED: missing config → `CleanFlowError(no-config)`. GREEN.

## Phase 6: banner extensions

- [x] 6.1 RED: `src/ui/banner.test.ts` — `formatWorktreeTable(rows)` includes branch/path/age/status columns; `formatNoWorktrees()` mentions `peel run`.
- [x] 6.2 RED: `formatCleanSummary({outcomes, cancelled?})` — counts removed/skipped, lists running-skipped branches.
- [x] 6.3 RED: `formatRunningWarning(branch)` mentions branch name.
- [x] 6.4 GREEN: `src/ui/banner.ts` — add 4 pure formatters.

## Phase 7: commands wiring

- [x] 7.1 RED: `src/commands/list.test.ts` — `runListCommand({cwd})` returns `{exitCode:0, message: <table>}` for happy path; non-zero + init hint on missing config.
- [x] 7.2 GREEN: `src/commands/list.ts`.
- [x] 7.3 RED: `src/commands/clean.test.ts` — single mode happy path; branch-not-found maps to friendly error; bulk cancellation returns 0; missing config → init hint.
- [x] 7.4 GREEN: `src/commands/clean.ts`.

## Phase 8: index.ts

- [x] 8.1 Register `peel list` and `peel clean [branch]` with flags `--all`, `--stale`, `-y/--yes`, `--no-fetch`. Existing init/run tests stay green.

## Phase 9: integration

- [x] 9.1 RED: `test/list-clean.integration.test.ts` — fixture create tool worktree via `peel run --keep …` (fake-dev) → `peel list` exits 0 with the branch in stdout → `peel clean <branch>` exits 0 → second `peel list` shows no rows.

## Phase 10: docs + gates

- [x] 10.1 README — add "Manage worktrees" section with `peel list`, `peel clean <branch>`, `peel clean --all`, `peel clean --stale`.
- [x] 10.2 `npm run prepublishOnly` end-to-end green.
- [x] 10.3 Final `git status` review — no stray tmp/lock files.
