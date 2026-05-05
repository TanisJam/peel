# Verification Report: peel-list-clean

**Change**: peel-list-clean
**Mode**: Strict TDD
**Capabilities**: 3 NEW (worktree-filter, list-command, clean-command)

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 36 |
| Tasks complete | 36 |
| Tasks incomplete | 0 |

All 10 phases marked `[x]`. Apply-progress confirms.

---

## Build & Tests Execution

| Gate | Result |
|---|---|
| `npm run lint` | ✅ 70 files, 0 errors |
| `npm run typecheck` | ✅ no errors |
| `npm run build` | ✅ `dist/index.js` 52.31 KB |
| `npm run test` | ✅ **193 / 193 passed** (191 unit + 2 integration), 0 skipped |

**Coverage**: ➖ Not measured (`@vitest/coverage-v8` deferred per peel-run-command verify SUGGESTION).

---

## TDD Compliance (Strict TDD)

✅ COMPLIANT.

Apply-progress contains a complete TDD Cycle Evidence table — every behavior task pair shows RED (test written first) → GREEN → TRIANGULATE (≥ 2 cases) → REFACTOR. Skipped triangulation is explicitly justified for the two structural tasks (index.ts wiring; docs/gates). The `src/ui/banner.ts` modification is protected by its pre-existing 4-test baseline + 9 newly-added tests, all green.

---

## Test Layer Distribution

| Layer | Files (this change) | Tests (this change) | Notes |
|---|---|---|---|
| Unit | 9 new + 1 modified | 35 new (16 worktree-filter + 5 list-flow + 13 clean-flow + 5 commands) + 9 banner additions | All use `tmp-promise` for fs, `FakePrompter` for prompts — no production-code mocks |
| Integration | 1 new | 2 new | Spawns built `dist/index.js` against the shared git fixture; happy round-trip + outside-git-repo |
| Total project | 32 files | 193 | All passing |

---

## Spec Compliance Matrix

### worktree-filter (10 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Filter Tool-Created Worktrees | Tool-created worktree included | `src/core/worktree-filter.test.ts > filterToolWorktrees > includes basename-matching tool worktrees and excludes the main repoRoot` | ✅ COMPLIANT |
| Filter Tool-Created Worktrees | Main worktree excluded | same test | ✅ COMPLIANT |
| Filter Tool-Created Worktrees | Foreign path excluded | `… > excludes paths outside baseDir` | ✅ COMPLIANT |
| Filter Tool-Created Worktrees | Detached HEAD worktree excluded | `… > excludes detached HEAD worktrees` | ✅ COMPLIANT |
| Detect Worktree Status | Live lock means running | `… > getWorktreeStatus > returns 'running' when peel.lock contains the current process PID` | ✅ COMPLIANT |
| Detect Worktree Status | Stale lock means idle | `… > returns 'idle' when peel.lock contains a dead PID` | ✅ COMPLIANT |
| Detect Worktree Status | No lock means idle | `… > returns 'idle' when no peel.lock exists` | ✅ COMPLIANT |
| Compute and Format Age | Sub-minute formatted as seconds | `… > formatAge > formats sub-minute as seconds` | ✅ COMPLIANT |
| Compute and Format Age | Multi-hour formatted as hours | `… > formats hours when >= 60m` | ✅ COMPLIANT |
| Compute and Format Age | Multi-day formatted as days | `… > formats days when >= 24h` | ✅ COMPLIANT |

### list-command (4 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Render Tool-Created Worktrees | Lists tool-created worktrees with all columns | `src/core/list-flow.test.ts > listFlow > returns rows for tool-created worktrees and excludes the main repo` + integration `peel list + peel clean (integration) > list shows the worktree created by --keep, then clean removes it` | ✅ COMPLIANT |
| Render Tool-Created Worktrees | Empty state | `src/core/list-flow.test.ts > returns empty rows when no tool-created worktrees exist` + `src/ui/banner.test.ts > formatNoWorktrees > mentions peel run as the next step` + integration final `peel list` | ✅ COMPLIANT |
| Status Column Reflects peel.lock | Running and idle distinguished | `src/core/list-flow.test.ts > populates status and ageMs per row` | ✅ COMPLIANT |
| Config Required | Missing config | `src/commands/list.test.ts > runListCommand > returns exitCode:1 with a peel-init hint outside a git repo` + integration | ✅ COMPLIANT |

### clean-command (9 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Single-Branch Removal | Removes the named worktree | `src/core/clean-flow.test.ts > cleanFlow — single > removes the matching tool worktree` + integration | ✅ COMPLIANT |
| Single-Branch Removal | Branch not in tool-created set | `… > throws CleanFlowError(branch-not-found) when branch is not a tool worktree` | ✅ COMPLIANT |
| Single-Branch Removal | Single-target running with warning | `… > removes a single-target running worktree but flags runningWarning` | ✅ COMPLIANT |
| Bulk Removal With Confirmation | Confirms then removes idle worktrees | `… > prompts for confirmation when --yes is false; accept removes all` | ✅ COMPLIANT |
| Bulk Removal With Confirmation | User declines confirmation | `… > declined confirmation removes nothing and returns cancelled:true` | ✅ COMPLIANT |
| Bulk Removal With Confirmation | Skips running worktrees in bulk | `… > skips running worktrees in bulk and reports them in outcomes` | ✅ COMPLIANT |
| Stale Removal | Removes worktrees whose branch vanished | `… > cleanFlow — stale > removes worktrees whose branch exists neither locally nor remotely` | ✅ COMPLIANT |
| Stale Removal | Preserves worktrees whose branch still exists | `… > preserves worktrees whose branch still exists locally` | ✅ COMPLIANT |
| Stale Removal | Fetch failure does not block stale check | `… > logs a warning when fetch fails but still computes staleness from local view` | ✅ COMPLIANT |
| Config Required | Missing config | `src/commands/clean.test.ts > runCleanCommand > returns exitCode:1 with a peel-init hint outside a git repo` + `src/core/clean-flow.test.ts > cleanFlow — config gate > throws CleanFlowError(no-config) when .peel.yml is missing` | ✅ COMPLIANT |

**Compliance summary**: **23 / 23** scenarios COMPLIANT (all spec scenarios across 3 capabilities). 0 PARTIAL, 0 UNTESTED.

---

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| `peel.lock` for status detection (not port probing) | ✅ | `getWorktreeStatus` reuses `process.kill(pid, 0)` from `runFlow` |
| Single-target proceeds with warning; bulk modes skip running | ✅ | `runningWarning` flag; `partitionByStatus` in clean-flow |
| Three flow files (filter / list / clean) | ✅ | Each file is small (~70-160 lines) and focused |
| `--yes` does NOT override running-skip in bulk modes | ✅ | `partitionByStatus` runs after the confirmation gate |
| Pure helpers (`worktree-filter.ts`) | ✅ | All functions are pure; only fs reads via Node sync APIs |
| File inventory matches design | ✅ | All 11 new + 3 modified files present |
| Mtime-based age | ✅ | `getWorktreeAge` reads `statSync().mtimeMs` |
| Levenshtein/fuzzy NOT added (deferred) | ✅ | List output uses simple padded columns; fuzzy picker still TODO |

All deviations documented in apply-progress are minor (TS ergonomics on `Prompter`; biome-driven import ordering inside `banner.ts`) and have no behavioral impact.

---

## File Inventory vs Design

| File | Expected | Present | Status |
|---|---|---|---|
| `src/core/worktree-filter.ts` (+ test) | New | Yes | ✅ |
| `src/core/list-flow.ts` (+ test) | New | Yes | ✅ |
| `src/core/clean-flow.ts` (+ test) | New | Yes | ✅ |
| `src/commands/list.ts` (+ test) | New | Yes | ✅ |
| `src/commands/clean.ts` (+ test) | New | Yes | ✅ |
| `src/ui/banner.ts` (+ test) | Modified | Yes (4 new formatters + 9 tests) | ✅ |
| `src/index.ts` | Modified | Yes (`list` and `clean [branch]` registered) | ✅ |
| `test/list-clean.integration.test.ts` | New | Yes | ✅ |
| `README.md` | Modified | Yes ("Manage worktrees" section) | ✅ |

---

## Issues Found

**CRITICAL** (must fix before archive):
None.

**WARNING** (should fix):
None. All deviations documented and acceptable.

**SUGGESTION** (nice to have):
1. Add a unit test for `runListCommand` against a real git fixture with worktrees (currently only the no-config error path is unit-tested; the table render path is exercised by integration only). Low value since the table comes from `formatWorktreeTable` which IS unit-tested.
2. Surface a flag `peel clean <branch> --force` for explicit override of running-state — currently single-target proceeds with a warning unconditionally, which is acceptable but a `--force` discriminator would make the contract more explicit.
3. Add `@vitest/coverage-v8` (carried over from peel-run-command verify SUGGESTION).
4. Consider migrating the banner.ts imports to the top of the file (biome lint:fix preserved the appended position).

---

## Verdict

✅ **PASS**

All gates green (lint, typecheck, build, 193/193 tests including 2 new integration tests). 23/23 spec scenarios COMPLIANT. TDD evidence complete. No critical or warning issues. Ready to commit, push, open PR.
