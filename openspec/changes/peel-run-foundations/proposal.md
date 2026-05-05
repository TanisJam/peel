# Proposal: peel-run-foundations

## Intent

`peel run` (PRD §6.2) needs four primitive layers — config loading, git ops, worktree wrappers, port checking — none of which exist yet. Building those primitives in a single focused change keeps each module testable in isolation and lets the eventual `peel run` command be a thin orchestrator on top.

## Scope

### In Scope
- `src/core/config-load.ts` — locate `.peel.yml` (cwd or git root), parse YAML, deep-merge with `DEFAULT_CONFIG`, validate against `ConfigSchema`, friendly errors.
- `src/core/git.ts` — `findGitRoot` (extracted from `commands/init.ts`), `getRepoName`, `currentBranch`, `gitFetch` (optional, network-failure-tolerant), `listBranches` via `git for-each-ref` (deduplicated, committerdate-desc, optional pattern excludes).
- `src/core/worktree.ts` — `slugify`, `worktreePath`, `createWorktree` (handles remote-only branches with `--track`), `listWorktrees` (parses `--porcelain`), `removeWorktree` (`--force`).
- `src/core/port.ts` — `isPortBusy`, `findFreePort` (rolled in-house, no `get-port` dep), `whoHoldsPort` (best-effort `lsof` then `ss`, returns `null` on failure).
- Refactor `src/commands/init.ts` to import `findGitRoot` from `core/git.ts` (no behavior change).
- Add runtime dep `execa`.
- Test fixture `src/test-utils/git-fixture.ts` that creates a real bare-repo + working-repo pair (file:// remote) with seeded branches; reused by every git/worktree test.
- Strict TDD: every behavior task is RED → GREEN → TRIANGULATE → REFACTOR with real fs and real git via `tmp-promise`. No mocks.

### Out of Scope
- `peel run` CLI subcommand and its prompts — separate change.
- Cleanup-on-signal trap, install/build spawning, banner output — separate change.
- Caching of fetched branches.
- Windows native support (PRD §3 — out of MVP).

## Capabilities

### New Capabilities
- `config-load`: Reading `.peel.yml`, merging with defaults, validating, surfacing friendly errors.
- `git-ops`: Pure git query/operation primitives — root finding, fetch, branch listing, repo name, current branch.
- `worktree-ops`: `git worktree` wrappers with safe path slugging and conflict detection.
- `port-ops`: Local TCP port availability checks and best-effort process identification.

### Modified Capabilities
None. The `init-command` refactor is implementation-only — `findGitRoot` moves from `commands/init.ts` to `core/git.ts` with the same signature; observable behavior of `peel init` is unchanged.

## Approach

Bottom-up, in order: `config-load` → `git-ops` → `worktree-ops` → `port-ops` → refactor `init.ts`. Each module ships with its own test file using a shared real-git fixture. `whoHoldsPort` tests skip when `which lsof` fails (CI matrix ubuntu/macos has it).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/core/config-load.ts` | New | Read + parse + merge + validate |
| `src/core/git.ts` | New | Git primitives, owns `findGitRoot` |
| `src/core/worktree.ts` | New | Worktree wrappers |
| `src/core/port.ts` | New | TCP and `lsof`/`ss` helpers |
| `src/test-utils/git-fixture.ts` | New | Reusable bare/working repo helper |
| `src/core/{config-load,git,worktree,port}.test.ts` | New | Unit + integration; real fs/git/net |
| `test/foundations.integration.test.ts` | New | End-to-end fixture lifecycle |
| `src/commands/init.ts` | Modified | Import `findGitRoot` from `core/git.ts` |
| `package.json` | Modified | + `execa` runtime dep |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Slow integration tests (real git + real net) | Med | Cheap fixture: 1 commit, 2 branches; reused per-suite |
| `lsof` missing on minimal containers | Low | Skip describe block when `which lsof` fails |
| Port test parallel collisions | Low | Use OS-assigned ports as base + per-test offset |
| `git fetch` failing in offline tests | Low | Use `file://` remotes only; never network |
| Slug collision (e.g. `feat/foo` and `feat-foo`) | Very Low | Document; conflict surfaces via `git worktree add` error |

## Rollback Plan

Single-PR change. Revert the merge commit. The `peel init` behavior is unchanged because the only edit there is an import path swap; revert restores the inline `findGitRoot` and the new modules vanish.

## Dependencies

Runtime: `execa` (new).

## Success Criteria

- [ ] All four primitive modules ship with passing RED → GREEN → TRIANGULATE evidence.
- [ ] `loadConfig` reads, merges, and validates a real `.peel.yml`; rejects malformed/version-mismatched.
- [ ] `listBranches` returns deduplicated local+origin entries sorted by committerdate desc against the test fixture.
- [ ] `createWorktree` + `listWorktrees` + `removeWorktree` round-trip cleanly.
- [ ] `isPortBusy` and `findFreePort` work against real `net.Server` instances; `whoHoldsPort` returns the spawning test's PID.
- [ ] Existing `peel init` tests still pass after the `findGitRoot` extraction.
- [ ] CI matrix green on Node 20 + 22 × ubuntu + macos.
