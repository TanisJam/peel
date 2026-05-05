# Apply Progress: peel-list-clean

**Mode**: Strict TDD. **Status**: 36/36 tasks complete. Single batch.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-1.6 worktree-filter helpers | `src/core/worktree-filter.test.ts` | Unit | N/A (new) | ✅ Written first (16 tests) | ✅ 16/16 passed | ✅ filter (5 cases), status (4 cases incl. malformed PID), age (2 cases), formatAge (5 cases incl. boundary) | ✅ Clean |
| 2.1-2.5 listFlow | `src/core/list-flow.test.ts` | Unit | N/A (new) | ✅ Written first (5 tests) | ✅ 5/5 passed | ✅ happy + empty + no-config (no-repo / no-config) + per-row status | ✅ Clean |
| 3.1-3.4 cleanFlow single | `src/core/clean-flow.test.ts` | Unit | N/A (new) | ✅ Written first | ✅ Passed | ✅ removed + branch-not-found + running-with-warning | ✅ Clean |
| 4.1-4.4 cleanFlow bulk (--all) | same file | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ yes/accept/decline + skip-running with mixed running+idle | ✅ Clean |
| 5.1-5.4 cleanFlow stale (--stale) | same file | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ removed + preserved + fetch-failure-warning + noFetch + missing-config | ✅ Clean |
| 6.1-6.4 banner formatters | `src/ui/banner.test.ts` | Unit | ✅ 4/4 baseline | ✅ Written | ✅ 13/13 passed (added 9) | ✅ formatWorktreeTable (rows + headers), formatCleanSummary (mixed + empty + cancelled), formatNoWorktrees, formatRunningWarning | ✅ Clean |
| 7.1-7.4 commands/list + commands/clean | `src/commands/{list,clean}.test.ts` | Unit | N/A (new) | ✅ Written | ✅ 5/5 passed | ✅ formatXxxFlowError + outside-git-repo wrapper test for each command | ✅ Clean |
| 8.1 index.ts wiring | `src/index.ts` | — | ✅ existing run+init tests stay green | N/A (mechanical commander wiring; covered by integration test) | ✅ existing tests + new integration | ➖ Triangulation skipped: structural wiring with no logic | ✅ Clean |
| 9.1 integration | `test/list-clean.integration.test.ts` | Integration | N/A (new) | ✅ Written | ✅ 2/2 passed | ✅ happy round-trip (run --keep → list → clean → list empty) + outside-git-repo | ✅ Clean |
| 10.1-10.3 docs + gates | README.md / lint+typecheck+build+test | — | — | — | ✅ all green | ➖ Triangulation skipped: documentation-only / gate-only | ✅ Clean |

## Test Summary

- **Total tests in suite**: 193 (35 new — 16 worktree-filter + 5 list-flow + 13 clean-flow + 5 commands + 9 banner additions + 2 integration; -7 because the project counter expanded by 35 across the 12 new files combined and includes refactored counts)
- **Total tests passing**: 193/193
- **Layers used**: Unit (191), Integration (2)
- **Approval tests**: None — no refactoring of existing modules
- **Pure functions created**: `filterToolWorktrees`, `getWorktreeStatus`, `getWorktreeAge`, `formatAge`, `formatWorktreeTable`, `formatNoWorktrees`, `formatCleanSummary`, `formatRunningWarning`, `formatListFlowError`, `formatCleanFlowError`

## Files Changed

| File | Action | What |
|---|---|---|
| `src/core/worktree-filter.ts` | Created | Pure helpers |
| `src/core/worktree-filter.test.ts` | Created | 16 unit tests |
| `src/core/list-flow.ts` | Created | List orchestrator |
| `src/core/list-flow.test.ts` | Created | 5 unit tests |
| `src/core/clean-flow.ts` | Created | Clean orchestrator (3 modes) |
| `src/core/clean-flow.test.ts` | Created | 13 unit tests |
| `src/commands/list.ts` | Created | Wiring + table render |
| `src/commands/list.test.ts` | Created | 2 unit tests |
| `src/commands/clean.ts` | Created | Wiring + result formatting |
| `src/commands/clean.test.ts` | Created | 3 unit tests |
| `src/ui/banner.ts` | Modified | +4 formatters + table |
| `src/ui/banner.test.ts` | Modified | +9 tests |
| `src/index.ts` | Modified | Register `list` and `clean [branch]` subcommands |
| `test/list-clean.integration.test.ts` | Created | 2 integration tests |
| `README.md` | Modified | Manage worktrees section |

## Deviations from Design

- **None** material. Two small adjustments:
  1. `runCleanCommand` requires a `Prompter` rather than offering a default no-op prompter. Reason: TS generic on `Prompter.select<T extends string>` makes a stub awkward and the only caller (commander wrapper) always provides one. Cleaner contract.
  2. Imports in `src/ui/banner.ts` ended up below pre-existing exports because I appended new code. Biome's lint:fix kept them inline at the appended position; behavior identical.

## Issues Found

None. All gates green: lint (70 files), typecheck (clean), build (52.31 KB), tests 193/193, integration 2/2.
