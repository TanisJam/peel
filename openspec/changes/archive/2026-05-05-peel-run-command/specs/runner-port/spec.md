# runner-port Specification

## Purpose

Provide a process-spawning abstraction so commands can be tested without driving real subprocesses. Two modes: `run` (await output) for short-lived commands; `spawn` (stdio inherited) for long-lived dev/build servers.

## Requirements

### Requirement: Run Captures Output

The system MUST expose `Runner.run({ command, cwd, signal? })` returning `{ exitCode, stdout, stderr }` after the process exits. Combined output MUST NOT lose lines (interleaving order is implementation-defined).

#### Scenario: Captures stdout and stderr
- GIVEN a command that prints `out\n` to stdout and `err\n` to stderr and exits 1
- WHEN `runner.run(...)` resolves
- THEN `exitCode === 1`, `stdout` contains `"out"`, `stderr` contains `"err"`

### Requirement: Spawn Inherits Stdio

The system MUST expose `Runner.spawn({ command, cwd })` returning `{ kill, exited }` where `exited` resolves with `{ exitCode, signal }` when the child terminates. The real adapter MUST inherit stdio so the dev server's output reaches the user's terminal directly.

#### Scenario: Child exits cleanly
- GIVEN a command that exits 0
- WHEN `runner.spawn(...)` is called and the child finishes
- THEN `exited` resolves with `{ exitCode: 0, signal: null }`

### Requirement: Kill Forwards Signal

The system MUST expose `kill(signal)` on the spawn handle that delivers the signal to the child process.

#### Scenario: Kill SIGTERM stops the child
- GIVEN a long-running child
- WHEN `kill('SIGTERM')` is called
- THEN `exited` eventually resolves with `signal === 'SIGTERM'`
