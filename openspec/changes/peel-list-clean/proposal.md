# Proposal: peel-list-clean

## Intent

Implement PRD §6.3 (`peel list`) and §6.4 (`peel clean`) in a single change. Without these, users have no way to inspect or remove peel-created worktrees except by hand. They are the housekeeping pair that closes the MVP loop with `peel run`.

## Scope

### In Scope
- `peel list` — table of tool-created worktrees: branch, path, age, status (running/idle/unknown).
- `peel clean <branch>` — remove a single tool-created worktree.
- `peel clean --all` — remove all tool-created worktrees, with confirmation.
- `peel clean --stale` — remove worktrees whose branches no longer exist locally OR remotely.
- `--yes/-y` to suppress confirmation; bulk modes still SKIP running worktrees.
- "Running" detection via existing `peel.lock` + `process.kill(pid, 0)`.
- "Tool-created" filter via `(path under config.worktree.baseDir) AND (basename matches "<repoName>-<slug>") AND (path !== repoRoot)`.
- Best-effort `git fetch` before `--stale` (skipped on `--no-fetch` or when `git.fetchOnStart: false`).
- README "Manage worktrees" section.

### Out of Scope
- `peel config show/edit/path` (PRD §6.5) — separate change.
- Cross-platform process-cwd inspection — replaced by the more reliable `peel.lock` signal.
- `--age <duration>` filtering — not in PRD.
- Resurrecting worktrees by re-attaching them — out of scope.

## Capabilities

### New Capabilities
- `worktree-filter`: pure helpers — `filterToolWorktrees`, `getWorktreeStatus` (running/idle/unknown via `peel.lock` + PID liveness), `getWorktreeAge`, `formatAge`.
- `list-command`: `peel list` flow producing rows of (branch, path, age, status) for tool-created worktrees only; outputs an empty-state hint when none exist.
- `clean-command`: `peel clean` flow with three modes (single/all/stale), confirmation gating (suppressed by `-y`), running-skip semantics for bulk modes, and a summary of removed/skipped/errored.

### Modified Capabilities
None.

## Approach

Match the established `runFlow` layering. Pure helpers in `core/worktree-filter.ts` are composed by `core/list-flow.ts` and `core/clean-flow.ts` (orchestrators). Thin command wrappers in `commands/list.ts` and `commands/clean.ts` build adapter dependencies and render banners. Banner formatters added to `ui/banner.ts`. Strict TDD throughout — `FakePrompter` for confirmations, real `tmp-promise` git fixture for the integration tests.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/core/worktree-filter.ts` (+ test) | New | Pure helpers |
| `src/core/list-flow.ts` (+ test) | New | List orchestrator |
| `src/core/clean-flow.ts` (+ test) | New | Clean orchestrator (3 modes) |
| `src/commands/list.ts` (+ test) | New | Wiring + table render |
| `src/commands/clean.ts` (+ test) | New | Wiring + result formatting |
| `src/ui/banner.ts` (+ test) | Modified | Add `formatWorktreeTable`, `formatCleanSummary`, `formatNoWorktrees` |
| `src/index.ts` | Modified | Register `list` and `clean` |
| `test/list-clean.integration.test.ts` | New | End-to-end via shared fixture |
| `README.md` | Modified | Document the two commands |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Slug collisions across branches | Low | Same risk exists in `run`; not a regression |
| Offline `--stale` false positive | Med | Best-effort fetch first; warn when fetch fails |
| Force-removing a running dev server | Med | Bulk modes skip running; single-target warns |

## Rollback Plan

Revert the merge commit. `peel.lock` semantics already exist; nothing else writes new state.

## Dependencies

None new. All primitives ship.

## Success Criteria

- [ ] `peel list` shows all tool-created worktrees with correct branch/path/age/status; main worktree never appears.
- [ ] `peel clean <branch>` removes the matching worktree; reports a friendly error on miss.
- [ ] `peel clean --all` confirms once, then removes idle worktrees and reports skipped running ones.
- [ ] `peel clean --stale` removes worktrees whose branches don't exist locally or remotely.
- [ ] All gates green: lint, typecheck, build, full test suite, CI matrix.
- [ ] Strict TDD evidence in apply-progress: every behavior task has RED → GREEN → TRIANGULATE.
