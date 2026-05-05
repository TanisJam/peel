# Tasks: peel-run-foundations

> Strict TDD active. Real fs, real git, real net. No mocks.

## Phase 1: Foundation

- [x] 1.1 Install runtime dep `execa`. Verify with `npm ls --depth=0`.

## Phase 2: Shared Git Fixture

- [x] 2.1 RED: `src/test-utils/git-fixture.test.ts` — assert `createGitFixture()` returns `{ repoRoot, bareRoot, cleanup }`; the working repo has 2 branches (`main`, `feature/x`) and origin pointing to the bare repo via `file://`. `cleanup()` removes both dirs.
- [x] 2.2 GREEN: implement `src/test-utils/git-fixture.ts` (init bare, init main repo, seed two commits/branches, push, set origin). Tests pass.

## Phase 3: config-load

- [x] 3.1 RED: `src/core/config-load.test.ts` — happy path (valid `.peel.yml` at cwd merged with defaults), walk-up to git root (REQ Locate Config / walk-up scenario), null when absent (REQ Locate Config / null scenario), array-replace not concat (REQ Merge / arrays scenario), schema-invalid throws `PeelConfigError` with field path (REQ Validate / schema-invalid), malformed YAML throws `PeelConfigError` (REQ Validate / malformed). All use `tmp-promise`.
- [x] 3.2 GREEN: `src/core/config-load.ts` — `loadConfig`, `PeelConfigError` (with `kind` enum). Tests pass.

## Phase 4: git-ops

- [x] 4.1 RED: `src/core/git.test.ts` — `findGitRoot` happy + null (REQ Find Git Root, both scenarios). Use the fixture for the happy path.
- [x] 4.2 GREEN: `findGitRoot` ported into `core/git.ts`. Tests pass.
- [x] 4.3 RED: tests for `getRepoName` — origin URL parsing + dir basename fallback (REQ Get Repo Name, both scenarios).
- [x] 4.4 GREEN: `getRepoName`. Tests pass.
- [x] 4.5 RED: tests for `currentBranch` — symbolic ref + detached HEAD null (REQ Current Branch, both scenarios).
- [x] 4.6 GREEN: `currentBranch` via `git symbolic-ref --short HEAD`. Tests pass.
- [x] 4.7 RED: tests for `gitFetch` — success against fixture's `file://` remote; failure when remote unconfigured returns `{ ok:false, error }` (REQ Fetch, both scenarios).
- [x] 4.8 GREEN: `gitFetch` with execa + 15 s default timeout. Tests pass.
- [x] 4.9 RED: tests for `listBranches` — dedupe local+origin (REQ scenario 1), exclude pattern (scenario 2), committerdate desc (scenario 3).
- [x] 4.10 GREEN: `listBranches` via `git for-each-ref` + parsing + dedupe + sort. Tests pass.

## Phase 5: worktree-ops

- [x] 5.1 RED: `src/core/worktree.test.ts` — `slugify` replaces slashes (REQ Slugify scenario 1), collapses runs (scenario 2). Pure unit.
- [x] 5.2 GREEN: `slugify`. Tests pass.
- [x] 5.3 RED: `worktreePath` deterministic composition (REQ Worktree Path scenario).
- [x] 5.4 GREEN: `worktreePath`.
- [x] 5.5 RED: `createWorktree` — local branch (REQ Create / local scenario), remote-only with `--track` (scenario 2), path conflict throws `WorktreeError(kind: "path-exists")` (scenario 3). Uses fixture.
- [x] 5.6 GREEN: `createWorktree` + `WorktreeError` class.
- [x] 5.7 RED: `listWorktrees` returns main + secondary (REQ List scenario).
- [x] 5.8 GREEN: `listWorktrees` parsing `git worktree list --porcelain`.
- [x] 5.9 RED: `removeWorktree` removes happy path (REQ Remove scenario 1) and is idempotent on missing path (scenario 2).
- [x] 5.10 GREEN: `removeWorktree`.

## Phase 6: port-ops

- [x] 6.1 RED: `src/core/port.test.ts` — `isPortBusy` false on free port (REQ scenario 1), true on bound port (scenario 2). Use ephemeral `net.Server` for the bound case.
- [x] 6.2 GREEN: `isPortBusy`.
- [x] 6.3 RED: `findFreePort` returns base when free, skips busy, returns null when all busy (3 scenarios).
- [x] 6.4 GREEN: `findFreePort`.
- [x] 6.5 RED: `whoHoldsPort` returns `{ pid, command }` matching the test process when lsof exists, null when nothing listening, null without throwing when both tools absent. Wrap the lsof-required tests in a `describe.skipIf(!hasLsof)` guard.
- [x] 6.6 GREEN: `whoHoldsPort` with lsof+ss parsing.

## Phase 7: Refactor init

- [x] 7.1 Replace inline `findGitRoot` in `src/commands/init.ts` with `import { findGitRoot } from "../core/git.js"`. Run `npm run test:unit src/commands/init.test.ts` — must stay green with no test edits.

## Phase 8: Integration

- [x] 8.1 RED: `test/foundations.integration.test.ts` — using the fixture: `loadConfig` returns null, `listBranches` returns 2, `createWorktree` for `feature/x` succeeds, `listWorktrees` shows it, `removeWorktree` cleans up.
- [x] 8.2 GREEN: ensure all primitives compose; build first (`npm run build`), then `npm run test:integration`.

## Phase 9: Docs + Gates

- [x] 9.1 Run `npm run prepublishOnly` end-to-end — must pass.
- [x] 9.2 `git status` — no stray files, no leaked tmp dirs.
