# worktree-ops Specification

## Purpose

Wrap `git worktree` operations with a stable path scheme and conflict detection so the run flow can spin worktrees up and tear them down without leaving the working tree in a broken state.

## Requirements

### Requirement: Slugify Branch

The system MUST produce a path-safe slug for any branch name by replacing every character outside `[A-Za-z0-9_.-]` with `-` and collapsing consecutive `-` into a single `-`.

#### Scenario: Replaces slashes
- GIVEN branch name `feature/x.y`
- WHEN slugified
- THEN the result is `feature-x.y`

#### Scenario: Collapses runs of replaced chars
- GIVEN branch name `feat//foo bar`
- WHEN slugified
- THEN the result is `feat-foo-bar`

### Requirement: Worktree Path

The system MUST compute a worktree path as `<baseDir>/<repoName>-<slug(branch)>` where `baseDir` is resolved relative to the git root. The path MUST be deterministic for the same inputs.

#### Scenario: Composes the path from inputs
- GIVEN `baseDir='..'`, `repoName='widget'`, `branch='feature/x'`, `repoRoot='/repo'`
- WHEN `worktreePath(...)` runs
- THEN it returns `/widget-feature-x` (parent of `/repo`)

### Requirement: Create Worktree

The system MUST create a worktree at the computed path checked out at the requested branch. When the branch exists only on `origin`, it MUST create a tracking local branch via `--track`. Conflicts (path already exists, branch already checked out elsewhere) MUST throw a typed error naming the conflict kind.

#### Scenario: Creates a worktree for a local branch
- GIVEN local branch `feature/x` exists
- WHEN `createWorktree({ repoRoot, path, branch: 'feature/x' })` runs
- THEN the path exists AND `git worktree list` includes it AND the working tree has `feature/x` checked out

#### Scenario: Creates a tracking worktree for a remote-only branch
- GIVEN `origin/feature/y` exists but no local `feature/y`
- WHEN `createWorktree({ ..., branch: 'feature/y' })` runs
- THEN a local branch `feature/y` is created, tracking `origin/feature/y`

#### Scenario: Path conflict surfaces as typed error
- GIVEN the target path already exists as a non-empty directory
- WHEN `createWorktree(...)` runs
- THEN it throws an error whose `kind === 'path-exists'`

### Requirement: List Worktrees

The system MUST list every worktree the repo currently knows about by parsing `git worktree list --porcelain`, returning `{ path, branch | null, head }` per entry. The main worktree MUST be included.

#### Scenario: Returns main + secondary worktrees
- GIVEN one secondary worktree was created at `/tmp/extra`
- WHEN `listWorktrees(repoRoot)` runs
- THEN the result contains both the main repo path and `/tmp/extra`

### Requirement: Remove Worktree

The system MUST remove a worktree forcibly (`git worktree remove --force`), tolerate "already gone" cases (returns `ok: true`), and report any other failure.

#### Scenario: Removes an existing worktree
- GIVEN a worktree at `/tmp/extra`
- WHEN `removeWorktree(repoRoot, '/tmp/extra')` runs
- THEN the path no longer exists AND `listWorktrees` no longer reports it

#### Scenario: Idempotent on missing path
- GIVEN no worktree at `/tmp/never-existed`
- WHEN `removeWorktree(repoRoot, '/tmp/never-existed')` runs
- THEN it returns `{ ok: true }` without throwing
