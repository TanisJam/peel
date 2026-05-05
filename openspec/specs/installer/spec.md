# installer Specification

## Purpose

Run the configured install command in a worktree, capturing the output so the failure UX can show the tail of the log and a path to the full log on disk.

## Requirements

### Requirement: Run Install And Capture Output

The system MUST execute the install command in the given working directory using the supplied `Runner`. It MUST return `{ ok: true }` on exit code 0. On non-zero exit it MUST return `{ ok: false, log, logPath }` where `log` is the full captured stdout+stderr and `logPath` is a file under `os.tmpdir()` containing the same log.

#### Scenario: Successful install
- GIVEN runner returns exit code 0
- WHEN `runInstall({ runner, cwd, command })` runs
- THEN it returns `{ ok: true }`

#### Scenario: Failed install captures log
- GIVEN runner returns exit 1 with combined output `"oh no"`
- WHEN `runInstall(...)` runs
- THEN result `ok` is `false` AND `log` contains `"oh no"` AND `logPath` is a real file containing the same content

### Requirement: Honor Skip-When-Reusing

When `skipIfNodeModules` is set and a `node_modules` directory already exists at `cwd`, the system MUST return `{ ok: true, skipped: true }` without invoking the runner.

#### Scenario: Skip when node_modules exists
- GIVEN `cwd/node_modules` exists AND `skipIfNodeModules: true`
- WHEN `runInstall(...)` runs
- THEN runner is NOT called AND result is `{ ok: true, skipped: true }`
