# git-ops Specification

## Purpose

Provide the read-side git primitives the rest of the CLI needs: locating the repo, identifying the repo and branch, fetching from origin (best-effort), and listing branches with stable ordering.

## Requirements

### Requirement: Find Git Root

The system MUST find the nearest ancestor directory containing a `.git` entry. It MUST return `null` when no such ancestor exists.

#### Scenario: Returns the repo root from a nested path
- GIVEN a git repo whose root is `/repo` and `cwd = /repo/packages/app`
- WHEN `findGitRoot(cwd)` runs
- THEN it returns `/repo`

#### Scenario: Returns null outside any repo
- GIVEN a directory with no `.git` in it or any parent
- WHEN `findGitRoot(cwd)` runs
- THEN it returns `null`

### Requirement: Get Repo Name

The system MUST return the repo name. It MUST prefer the last path segment of the `origin` remote URL (without `.git`); if no origin is set, it MUST fall back to the basename of the git root directory.

#### Scenario: Origin URL provides the name
- GIVEN `origin = git@github.com:acme/widget.git`
- WHEN `getRepoName(repoRoot)` runs
- THEN it returns `widget`

#### Scenario: Falls back to directory basename
- GIVEN no remotes configured AND repo root is `/tmp/my-app`
- WHEN `getRepoName(repoRoot)` runs
- THEN it returns `my-app`

### Requirement: Current Branch

The system MUST return the current branch name, or `null` for detached HEAD.

#### Scenario: Returns the symbolic ref
- GIVEN HEAD points to `refs/heads/main`
- WHEN `currentBranch(repoRoot)` runs
- THEN it returns `main`

#### Scenario: Detached HEAD returns null
- GIVEN HEAD is detached at a commit
- WHEN `currentBranch(repoRoot)` runs
- THEN it returns `null`

### Requirement: Fetch

The system MUST run `git fetch --prune` (or equivalent) when invoked. Network and permission errors MUST be reported as a non-throwing `{ ok: false, error }` result so callers can continue with local branches.

#### Scenario: Successful fetch
- GIVEN the configured origin is reachable (file:// in tests)
- WHEN `gitFetch(repoRoot)` runs
- THEN it returns `{ ok: true }`

#### Scenario: Unreachable remote does not throw
- GIVEN no origin remote is configured
- WHEN `gitFetch(repoRoot)` runs
- THEN it returns `{ ok: false, error: <message> }`

### Requirement: List Branches

The system MUST list git refs under `refs/heads` and `refs/remotes/origin`, deduplicate names so a branch with both a local and origin/X copy appears once, sort by committerdate descending, and respect optional pattern excludes.

#### Scenario: Deduplicates local and origin entries
- GIVEN local branch `feature/x` and remote ref `origin/feature/x`
- WHEN `listBranches(repoRoot)` runs
- THEN `feature/x` appears exactly once

#### Scenario: Honors exclude patterns
- GIVEN local branch `archive/old` and exclude pattern `archive/*`
- WHEN `listBranches(repoRoot, { exclude: ['archive/*'] })` runs
- THEN `archive/old` is omitted

#### Scenario: Sorts by committerdate desc
- GIVEN branch `older` (older commit) and branch `newer` (newer commit)
- WHEN `listBranches(repoRoot)` runs
- THEN `newer` precedes `older` in the result
