# worktree-filter Specification

## Purpose

Pure helpers that distinguish peel-created worktrees from arbitrary git worktrees, detect run status via `peel.lock`, and compute display-friendly age. Reused by `list-command` and `clean-command`.

## Requirements

### Requirement: Filter Tool-Created Worktrees

The system MUST classify a worktree as tool-created only when ALL hold:
- The path lives under `resolve(repoRoot, config.worktree.baseDir)`.
- The basename equals `<repoName>-<slugify(branch)>` (slug recomputed from the worktree's branch).
- The path is NOT the repoRoot itself.

#### Scenario: Tool-created worktree included

- GIVEN a worktree at `<baseDir>/myrepo-feature-x` with branch `feature/x`
- WHEN `filterToolWorktrees` runs with `repoRoot=…`, `baseDir=…`, `repoName=myrepo`
- THEN the worktree appears in the result

#### Scenario: Main worktree excluded

- GIVEN the repoRoot itself appears in `git worktree list`
- WHEN the filter runs
- THEN repoRoot is excluded regardless of basename

#### Scenario: Foreign path excluded

- GIVEN a worktree at `/some/other/place/whatever` not under `baseDir`
- WHEN the filter runs
- THEN it is excluded

#### Scenario: Detached HEAD worktree excluded

- GIVEN a worktree with `branch === null`
- WHEN the filter runs
- THEN it is excluded (cannot recompute slug)

### Requirement: Detect Worktree Status

The system SHALL return `"running"` when `peel.lock` contains a live PID, `"idle"` when the lock is missing or its PID is dead, and `"unknown"` only on unexpected I/O errors.

#### Scenario: Live lock means running

- GIVEN `<worktreePath>/peel.lock` exists with the current process PID
- WHEN `getWorktreeStatus(path)` runs
- THEN it returns `"running"`

#### Scenario: Stale lock means idle

- GIVEN `peel.lock` exists with a PID that is not alive
- WHEN `getWorktreeStatus(path)` runs
- THEN it returns `"idle"`

#### Scenario: No lock means idle

- GIVEN no `peel.lock` file exists
- WHEN `getWorktreeStatus(path)` runs
- THEN it returns `"idle"`

### Requirement: Compute and Format Age

The system MUST compute age as `now - mtimeMs(path)` in milliseconds and format it as the largest unit that yields a non-zero whole number: `<N>s`, `<N>m`, `<N>h`, `<N>d`.

#### Scenario: Sub-minute formatted as seconds

- GIVEN an age of 45_000 ms
- WHEN `formatAge(45_000)` runs
- THEN it returns `"45s"`

#### Scenario: Multi-hour formatted as hours

- GIVEN an age of 7_200_000 ms (2h)
- WHEN `formatAge(7_200_000)` runs
- THEN it returns `"2h"`

#### Scenario: Multi-day formatted as days

- GIVEN an age of 3 * 86_400_000 ms (3d)
- WHEN `formatAge(...)` runs
- THEN it returns `"3d"`
