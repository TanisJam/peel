# run-command Specification

## Purpose

`peel run [branch] [mode]` orchestrates the full PRD §6.2 flow: load config, fetch, list branches, pick branch, pick mode, verify port, create worktree, copy env, install, run hooks, print banner, spawn dev/build, register cleanup, wait, clean up.

## Requirements

### Requirement: Config Required

The system MUST load `.peel.yml` from the repo. If absent, it MUST exit non-zero with a message naming `peel init` as the fix.

#### Scenario: Missing config fails fast
- GIVEN no `.peel.yml` in the repo
- WHEN `peel run` runs
- THEN exit code is non-zero AND the error message mentions `peel init`

### Requirement: Branch Resolution

The system MUST resolve the target branch in this priority: positional argument, `--branch/-b` flag, interactive prompt. Cancel during prompt MUST exit 0 without side effects.

#### Scenario: Positional wins over prompt
- GIVEN `peel run feature/x` and `feature/x` is in the branch list
- WHEN it runs
- THEN no branch prompt is shown AND the worktree targets `feature/x`

### Requirement: Mode Resolution

The system MUST resolve the mode (`dev` | `build`) in this priority: positional argument, `--mode` flag, interactive prompt. The mode determines which command from `commands.{dev|build}` is spawned.

#### Scenario: --mode wins over prompt
- GIVEN `--mode build` and a complete config
- WHEN it runs
- THEN no mode prompt is shown AND the build command is spawned

### Requirement: Port Verification

The system MUST verify the target port before creating the worktree. With `port.strategy: fixed`, a busy port MUST abort with the friendly error from PRD §8.2. With `port.strategy: auto-find`, it MUST search up to 20 ports from `port.base` and use the first free one, informing the user. `--port <n>` overrides `port.base` for the run.

#### Scenario: Fixed and busy aborts
- GIVEN `strategy: fixed`, `base: 3000`, and 3000 is bound
- WHEN it runs
- THEN exit code is non-zero, the worktree is NOT created, and the message names PID + suggested kill

#### Scenario: auto-find skips busy
- GIVEN `strategy: auto-find`, `base: 3000`, 3000 bound, 3001 free
- WHEN it runs
- THEN the chosen port is `3001`

### Requirement: Worktree Lifecycle

The system MUST create the worktree, copy env files, run install (skipping when `--keep` and `node_modules` exists), run pre-run hooks, and spawn the mode command in that order. On any pre-spawn failure it MUST remove the just-created worktree before exiting non-zero.

#### Scenario: Pre-spawn failure cleans up
- GIVEN install runner returns exit 1
- WHEN it runs
- THEN the worktree is removed AND exit is non-zero AND the install log path is printed

### Requirement: Cleanup On Exit

The system MUST register a cleanup handler that removes the worktree on SIGINT, SIGTERM, and normal exit. With `--keep`, no removal is performed and the path is printed for reuse.

#### Scenario: Ctrl+C removes the worktree
- GIVEN a spawned dev process
- WHEN SIGINT is delivered
- THEN the child receives the signal AND, after it exits, the worktree no longer exists

#### Scenario: --keep preserves the worktree
- GIVEN `--keep`
- WHEN the dev process exits normally
- THEN the worktree directory still exists AND its path is printed

### Requirement: Concurrent Invocation Lock

The system MUST refuse to start when an existing `peel.lock` file in the worktree references a still-running PID; it MUST overwrite a stale lock (PID no longer alive).

#### Scenario: Refuses concurrent run
- GIVEN a `peel.lock` referencing a live PID exists
- WHEN `peel run` runs targeting that branch
- THEN exit is non-zero AND the message names the running PID
