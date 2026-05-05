# port-ops Specification

## Purpose

Provide local TCP port helpers so the run flow can decide whether the configured port is available, find an alternative within a bounded range, and surface a friendly "who is holding the port?" message when possible.

## Requirements

### Requirement: Is Port Busy

The system MUST report whether a TCP port on `127.0.0.1` is currently bound. It MUST close any probe socket it opened before returning.

#### Scenario: Free port returns false
- GIVEN no listener on port `P`
- WHEN `isPortBusy(P)` runs
- THEN it returns `false`

#### Scenario: Bound port returns true
- GIVEN a `net.Server` is listening on port `P`
- WHEN `isPortBusy(P)` runs
- THEN it returns `true`

### Requirement: Find Free Port

The system MUST search the inclusive range `[base, base + range)` and return the first free port. It MUST return `null` when every port in the range is busy.

#### Scenario: Returns the base when free
- GIVEN nothing is listening on `base`
- WHEN `findFreePort(base, 20)` runs
- THEN it returns `base`

#### Scenario: Skips busy ports
- GIVEN a listener on `base`
- WHEN `findFreePort(base, 20)` runs
- THEN it returns the next free port in the range

#### Scenario: Returns null when no port is free
- GIVEN every port in `[base, base+5)` is bound
- WHEN `findFreePort(base, 5)` runs
- THEN it returns `null`

### Requirement: Identify Process Holding A Port

The system SHOULD attempt to identify the process holding a port using `lsof` first and `ss` as a fallback. It MUST NOT throw when neither tool is available; it MUST return `null` to indicate "unknown".

#### Scenario: Returns the holding PID when lsof is available
- GIVEN a Node `net.Server` listening on a high port `P` AND `which lsof` succeeds
- WHEN `whoHoldsPort(P)` runs
- THEN it returns `{ pid: <test-process-pid>, command: <non-empty> }`

#### Scenario: Returns null on tooling absence
- GIVEN neither `lsof` nor `ss` is available on PATH
- WHEN `whoHoldsPort(P)` runs
- THEN it returns `null` without throwing

#### Scenario: Returns null when no one holds the port
- GIVEN nothing is listening on `P`
- WHEN `whoHoldsPort(P)` runs
- THEN it returns `null`
