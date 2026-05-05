# list-command Specification

## Purpose

`peel list` shows the user every tool-created worktree in the current repo as a table with branch, path, age, and status. Read-only; no side effects beyond stdout/stderr.

## Requirements

### Requirement: Render Tool-Created Worktrees

The system MUST list ONLY tool-created worktrees (per `worktree-filter`) and MUST NEVER include the main worktree.

#### Scenario: Lists tool-created worktrees with all columns

- GIVEN two tool-created worktrees and the main repo
- WHEN the user runs `peel list`
- THEN stdout contains a row for each tool-created worktree with branch, path, age (formatted) and status
- AND the main repo path is absent
- AND exit code is 0

#### Scenario: Empty state

- GIVEN no tool-created worktrees exist
- WHEN the user runs `peel list`
- THEN stdout contains a friendly empty-state message including the suggested next command (`peel run <branch>`)
- AND exit code is 0

### Requirement: Status Column Reflects peel.lock

The system SHALL display `"running"` for worktrees with a live `peel.lock` PID and `"idle"` otherwise, sourced from `getWorktreeStatus`.

#### Scenario: Running and idle distinguished

- GIVEN one worktree with a live lock and one without
- WHEN the user runs `peel list`
- THEN the first row's status column is `running` and the second's is `idle`

### Requirement: Config Required

The system MUST fail fast with a `peel init` hint when `.peel.yml` is absent.

#### Scenario: Missing config

- GIVEN no `.peel.yml` at the repo root
- WHEN the user runs `peel list`
- THEN stderr contains a message that mentions `peel init`
- AND exit code is non-zero
