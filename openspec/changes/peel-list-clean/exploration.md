# Exploration: peel-list-clean

> Implements PRD §6.3 (`peel list`) and §6.4 (`peel clean`) as a single change. Both compose existing primitives (`listWorktrees`, `removeWorktree`, `listBranches`, `loadConfig`) plus new filter/status helpers.

## Current State

- `src/core/worktree.ts` exposes `listWorktrees(repoRoot) → Worktree[]` (path, branch, head) and `removeWorktree(repoRoot, path) → {ok}` via `git worktree remove --force` with a fallback `git worktree prune`. Already used by `runFlow`.
- `src/core/git.ts` exposes `listBranches(repoRoot, opts?) → Branch[]` returning both local and remote refs (`isRemote: boolean`).
- `src/core/config-load.ts` returns the merged config; `worktree.baseDir` is the parent dir convention used to compute paths in `worktreePath({repoRoot, baseDir, repoName, branch})`.
- `src/core/run-flow.ts` writes `peel.lock` (PID) during a run and `isProcessAlive(pid)` (via `process.kill(pid, 0)`, EPERM = alive, ESRCH = dead) is the liveness check pattern.
- `src/core/port.ts` exposes `whoHoldsPort(port) → {pid, command} | null`.
- `src/index.ts` already wires `init` and `run` as commander subcommands and uses the `Prompter` port + `clack` adapter for confirmations.
- No "tool-created" filter exists today — `listWorktrees` returns ALL worktrees including the main repo and any user-created ones.

## Affected Areas

- `src/core/worktree.ts` — needs new filter + status helpers (or a sibling module).
- `src/core/list-flow.ts` (NEW) — orchestrator for `peel list`.
- `src/core/clean-flow.ts` (NEW) — orchestrator for `peel clean` (three modes).
- `src/commands/list.ts` (NEW) — wiring + table render.
- `src/commands/clean.ts` (NEW) — wiring + result formatting.
- `src/ui/banner.ts` — extend with `formatWorktreeTable`, `formatCleanSummary`, `formatNoWorktrees`.
- `src/index.ts` — register the two new subcommands.
- `test/list-clean.integration.test.ts` (NEW) — end-to-end with the shared git fixture.

## Design considerations

### How to identify "tool-created" worktrees

The PRD says "filtrar por prefix configurado". Today `worktree.prefix` defaults to empty, so the prefix alone is unreliable. The deterministic signal we have:

- Path lives under `resolve(repoRoot, config.worktree.baseDir)`.
- Basename matches `^${repoName}-${slug(branch)}$` (or `^${prefix}${repoName}-${slug(branch)}$`).
- Path is NOT the repoRoot itself (the main worktree).

A tuple of those three checks is robust. The slug round-trip is one-way (collisions theoretically possible) but acceptable since `peel run` uses the same `slugify` function.

### How to detect "running" status

The PRD suggests probing whether the configured port's holder has a cwd inside the worktree — but reading `cwd` for an arbitrary PID is messy cross-platform (`/proc/<pid>/cwd` on Linux, `lsof -d cwd` on macOS) and adds OS-specific code paths.

`peel run` already drops a `peel.lock` file containing the running PID inside the worktree. Reusing it:

- `peel.lock` exists AND PID alive → `"running"`.
- No lock OR stale PID → `"idle"`.
- Lock unreadable → `"unknown"`.

This is MORE reliable than the PRD's port probe because it survives port-strategy variation and doesn't depend on lsof/ss.

### How to compute "age"

Use `mtime` of the worktree directory (close to `git worktree add` time). Format human-friendly: `"5m"`, `"2h"`, `"3d"`.

### `peel clean` safety against running worktrees

PRD says `git worktree remove --force`. But forcing removal of an active dev server's worktree mid-run kills work-in-progress. Decision:
- `peel clean <branch>` (explicit single target) → proceed but warn if running.
- `peel clean --all` / `--stale` → SKIP running worktrees, report them as skipped.
- `--yes` flag suppresses confirmation but does NOT override the running-skip safety on bulk modes.

### Capability structure

Three capabilities. All NEW.

1. `worktree-filter` — pure helpers: `filterToolWorktrees`, `getWorktreeStatus`, `getWorktreeAge`, `formatAge`.
2. `list-command` — composes filter + status + age into the table rows; no side effects beyond stdout.
3. `clean-command` — three modes (single/all/stale), confirmation gating, running-skip semantics.

No existing spec is modified. The `worktree-ops` capability (covering `createWorktree`/`listWorktrees`/`removeWorktree`) stays as-is — `worktree-filter` is a separate concern (post-processing the list, not git plumbing).

## Approaches

1. **Composition with new pure helpers** *(recommended)* — `core/worktree-filter.ts` (pure helpers) + thin orchestrators `core/list-flow.ts` + `core/clean-flow.ts` + commander wiring.
   - Pros: matches existing layered pattern (port primitives → flow orchestrator → command wiring); pure helpers trivially unit-testable; both flows share the filter helper; no production-code mocks needed.
   - Cons: 5 new modules — but each is small (~30-60 lines).
   - Effort: Medium.

2. **Inline everything in `commands/list.ts` and `commands/clean.ts`** — skip the flow modules.
   - Pros: fewer files.
   - Cons: command modules end up doing both "decide what to do" and "render UI"; less testable; diverges from the `runFlow` pattern. Hard to add a SIGINT trap or `--yes` confirmation cleanly without the flow layer.
   - Effort: Low.

3. **Single `peel-manage` command with subcommands** — `peel manage list`, `peel manage clean`.
   - Pros: groups admin commands.
   - Cons: PRD says `peel list` and `peel clean` as top-level commands; user-facing API breakage.
   - Effort: Low.

## Recommendation

**Approach 1.** It's the only one that matches the existing layered architecture (`core/*-flow.ts` orchestrator + `ui/banner.ts` formatters + `commands/*.ts` wiring) established in `peel-init` and `peel-run-command`. The filter helpers are reused by both flows, which justifies the dedicated module. Strict TDD on the pure helpers + flow orchestrators is identical to prior cycles — `FakePrompter` for confirmations, no other I/O fakes needed since worktree/git ops can use real `tmp-promise` fixtures.

## Risks

- **Cross-platform `mtime` precision** — node's `statSync().mtimeMs` works on linux+macOS; no concern in MVP scope (no Windows native).
- **Slug collisions** — two branches with identical slugs (e.g., `feature/x` and `feature-x`) would produce the same path and thus identical filter matches. Same risk exists in `peel run` today; not a regression.
- **Concurrency vs. peel.lock** — a worktree being removed in parallel by another `peel clean` invocation: lock check happens first; second invocation sees the worktree gone and skips. Acceptable.
- **Stale `--stale` in offline mode** — if `git fetch` was never run and the user's only ref of the remote branch is gone, `--stale` may falsely report the worktree as stale. Mitigation: like `peel run`, do best-effort `git fetch` first when `git.fetchOnStart: true` and `--no-fetch` not passed; otherwise warn that staleness is computed from the local view.
- **Clean of a worktree that had `--keep` re-runs accumulate `node_modules`** — not a correctness issue but worth documenting in README.

## Ready for Proposal

Yes. Three new capabilities (`worktree-filter`, `list-command`, `clean-command`), no spec modifications. Five new source modules + extension of `banner.ts` + new integration test. Strict TDD throughout.
