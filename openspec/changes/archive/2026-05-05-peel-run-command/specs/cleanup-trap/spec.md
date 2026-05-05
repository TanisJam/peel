# cleanup-trap Specification

## Purpose

Remove the worktree on process exit, including SIGINT (Ctrl+C) and SIGTERM, unless `--keep` is set. The cleanup logic itself MUST be a pure function so the orchestrator can unit-test it; signal registration is a thin separate layer.

## Requirements

### Requirement: Build Cleanup Handler

The system MUST expose `buildCleanupHandler(deps)` returning an async function that, when called, removes the worktree using the supplied `removeWorktree` unless `keep` is `true`. The returned function MUST be idempotent — multiple invocations result in at most one removal call.

#### Scenario: Removes the worktree by default
- GIVEN `keep: false` and a fake `removeWorktree`
- WHEN the handler is invoked
- THEN `removeWorktree(repoRoot, worktreePath)` is called exactly once

#### Scenario: --keep skips removal
- GIVEN `keep: true`
- WHEN the handler is invoked
- THEN `removeWorktree` is NOT called

#### Scenario: Idempotent under repeated calls
- GIVEN any deps
- WHEN the handler is invoked twice
- THEN `removeWorktree` is called at most once total

### Requirement: Trap Registration

The system MUST expose `installCleanupTrap(handler) → unregister()` that registers `handler` for SIGINT, SIGTERM, and `process.on('exit')`. The returned `unregister()` MUST remove every listener it added so tests can isolate themselves.

#### Scenario: Unregister removes all listeners
- GIVEN a freshly-installed trap
- WHEN `unregister()` is called
- THEN none of SIGINT, SIGTERM, exit listeners installed by `installCleanupTrap` remain on the process
