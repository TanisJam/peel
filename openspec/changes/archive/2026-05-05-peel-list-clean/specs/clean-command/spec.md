# clean-command Specification

## Purpose

`peel clean` removes peel-created worktrees. Three modes: single (`peel clean <branch>`), bulk (`peel clean --all`), and stale (`peel clean --stale`). Refuses to clobber running dev servers in bulk modes.

## Requirements

### Requirement: Single-Branch Removal

The system MUST resolve `<branch>` to a tool-created worktree and remove it via `removeWorktree`. The system MUST report a friendly error if no matching worktree exists.

#### Scenario: Removes the named worktree

- GIVEN a tool-created worktree for branch `feature/x`
- WHEN the user runs `peel clean feature/x`
- THEN the worktree directory no longer exists
- AND exit code is 0

#### Scenario: Branch not in tool-created set

- GIVEN no tool-created worktree exists for branch `nope`
- WHEN the user runs `peel clean nope`
- THEN stderr explains the branch was not found among tool-created worktrees
- AND exit code is non-zero

#### Scenario: Single-target running with warning

- GIVEN a tool-created worktree for `feature/x` whose `peel.lock` is live
- WHEN the user runs `peel clean feature/x`
- THEN stderr contains a warning that the worktree is running
- AND removal still proceeds (single-target is explicit user intent)

### Requirement: Bulk Removal With Confirmation

The system MUST prompt the user before removing more than one worktree under `--all`. The `-y/--yes` flag MUST suppress the prompt. Bulk modes SHALL skip running worktrees and report them in the summary.

#### Scenario: Confirms then removes idle worktrees

- GIVEN three idle tool-created worktrees and zero running
- WHEN the user runs `peel clean --all`
- THEN the prompter is asked to confirm and the user accepts
- AND all three worktrees are removed
- AND the summary lists 3 removed, 0 skipped
- AND exit code is 0

#### Scenario: User declines confirmation

- GIVEN multiple idle worktrees
- WHEN the user runs `peel clean --all` and declines the prompt
- THEN no worktree is removed
- AND exit code is 0

#### Scenario: Skips running worktrees in bulk

- GIVEN two idle worktrees and one running worktree
- WHEN the user runs `peel clean --all --yes`
- THEN the running worktree is preserved
- AND the summary reports 2 removed and 1 skipped (with branch + reason)
- AND exit code is 0

### Requirement: Stale Removal

The system MUST treat a worktree as stale when its branch exists neither locally nor remotely after a best-effort `git fetch` (skipped on `--no-fetch` or `git.fetchOnStart: false`). The system MUST skip running worktrees in stale mode and report them as skipped.

#### Scenario: Removes worktrees whose branch vanished

- GIVEN tool-created worktree for branch `gone` and `gone` no longer exists locally or remotely
- WHEN the user runs `peel clean --stale --yes`
- THEN the worktree is removed
- AND the summary reports 1 removed

#### Scenario: Preserves worktrees whose branch still exists

- GIVEN tool-created worktree for branch `feature/x` which still exists locally
- WHEN the user runs `peel clean --stale --yes`
- THEN the worktree is preserved
- AND the summary reports 0 removed

#### Scenario: Fetch failure does not block stale check

- GIVEN `git fetch` fails (offline)
- WHEN the user runs `peel clean --stale --yes`
- THEN a warning about the fetch failure is printed
- AND staleness is computed from the local view
- AND the command still completes with exit code 0

### Requirement: Config Required

The system MUST fail fast with a `peel init` hint when `.peel.yml` is absent.

#### Scenario: Missing config

- GIVEN no `.peel.yml` at the repo root
- WHEN the user runs any `peel clean` variant
- THEN stderr contains a message that mentions `peel init`
- AND exit code is non-zero
