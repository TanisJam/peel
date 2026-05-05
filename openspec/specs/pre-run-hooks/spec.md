# pre-run-hooks Specification

## Purpose

Execute a list of shell commands sequentially before the dev/build server starts (e.g., `pnpm prisma generate`). Stop and report the failure as soon as one command exits non-zero.

## Requirements

### Requirement: Sequential Execution

The system MUST execute each hook in order against the supplied `Runner`. It MUST return `{ ok: true }` after all hooks succeed. On the first non-zero exit it MUST stop and return `{ ok: false, failedAt: <index>, command: <string>, exitCode }`.

#### Scenario: All hooks succeed
- GIVEN hooks `["a", "b"]` and runner returns exit 0 for both
- WHEN `runHooks({ runner, cwd, hooks })` runs
- THEN runner is called twice in order AND result is `{ ok: true }`

#### Scenario: Stops at first failure
- GIVEN hooks `["a", "b", "c"]` and runner returns exit 0, then 2
- WHEN `runHooks(...)` runs
- THEN runner is called twice (NOT three times) AND result is `{ ok: false, failedAt: 1, command: "b", exitCode: 2 }`

#### Scenario: Empty list is a no-op
- GIVEN `hooks: []`
- WHEN `runHooks(...)` runs
- THEN runner is NOT called AND result is `{ ok: true }`
