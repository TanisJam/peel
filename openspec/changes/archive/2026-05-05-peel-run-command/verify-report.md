# Verification Report: peel-run-command

**Change**: peel-run-command
**Mode**: Strict TDD
**Capabilities**: 7 NEW (env-copy, installer, pre-run-hooks, runner-port, cleanup-trap, branch-picker, run-command)

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 36 |
| Tasks complete | 36 |
| Tasks incomplete | 0 |

All 12 phases marked `[x]`. Apply-progress confirms.

---

## Build & Tests Execution

| Gate | Result |
|---|---|
| `npm run lint` | ✅ 59 files, 0 errors |
| `npm run typecheck` | ✅ no errors |
| `npm run build` | ✅ `dist/index.js` 41.77 KB |
| `npm run test` | ✅ **145 / 145 passed** (139 unit + 6 integration), 0 skipped |

**Coverage**: ➖ Not measured (`@vitest/coverage-v8` deferred).

---

## TDD Compliance (Strict TDD)

✅ COMPLIANT.

Apply-progress contains a complete TDD Cycle Evidence table — every behavior task pair shows RED (test written first) → GREEN → TRIANGULATE (≥ 2 cases) → REFACTOR. Skipped triangulation is explicitly justified for the lone integration scenario. The init refactor (Phase 7 of prior change) and the index.ts wiring are protected by their pre-existing tests staying green without edits.

---

## Test Layer Distribution

| Layer | Files (this change) | Tests (this change) | Notes |
|---|---|---|---|
| Unit | 12 new | 43 new | All use `tmp-promise` for fs, `FakePrompter`/`FakeRunner` for I/O fakes — no production-code mocks |
| Integration | 1 new | 2 new | Spawns built `dist/index.js` against the shared git fixture; uses a fake-dev-server `.peel.yml` (`dev: node -e '…';process.exit(0)`) |
| Total project | 26 files | 145 | All passing |

---

## Spec Compliance Matrix

### env-copy (2 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Copy Files | Copies present, skips existing, reports missing | `src/core/env-copy.test.ts > copyEnvFiles > copies present, skips existing, reports missing` | ✅ COMPLIANT |
| Copy Files | Empty list is a no-op | `… > empty list is a no-op` | ✅ COMPLIANT |

### installer (3 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Run Install | Successful install | `src/core/installer.test.ts > runInstall > returns ok:true on exit code 0` | ✅ COMPLIANT |
| Run Install | Failed install captures log + tmp file | `… > returns ok:false with combined log + persistent log file on failure` | ✅ COMPLIANT |
| Honor Skip-When-Reusing | Skip when node_modules exists | `… > skipIfNodeModules: returns ok:true,skipped:true when node_modules exists, runner not called` | ✅ COMPLIANT |

### pre-run-hooks (3 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Sequential Execution | All hooks succeed | `src/core/hooks.test.ts > runHooks > runs all hooks in order when each succeeds` | ✅ COMPLIANT |
| Sequential Execution | Stops at first failure | `… > stops at first failure with index, command, and exit code` | ✅ COMPLIANT |
| Sequential Execution | Empty list is a no-op | `… > empty list is a no-op` | ✅ COMPLIANT |

### runner-port (3 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Run Captures Output | Captures stdout and stderr | `FakeRunner.run > returns scripted results in order and records calls` (validates the contract); the real adapter is exercised by `test/run.integration.test.ts` (install command via `runner.run`) | ⚠️ PARTIAL |
| Spawn Inherits Stdio | Child exits cleanly | `FakeRunner.spawn > returns a handle whose exited resolves with the scripted exit` + integration test where the spawned dev process prints "ready" via inherited stdio | ✅ COMPLIANT |
| Kill Forwards Signal | Kill SIGTERM stops the child | `FakeRunner.spawn > kill resolves a never-exiting child with the supplied signal` | ✅ COMPLIANT |

### cleanup-trap (4 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Build Cleanup Handler | Removes the worktree by default | `src/core/cleanup.test.ts > buildCleanupHandler > removes the worktree by default` | ✅ COMPLIANT |
| Build Cleanup Handler | --keep skips removal | `… > --keep skips removal` | ✅ COMPLIANT |
| Build Cleanup Handler | Idempotent under repeated calls | `… > is idempotent under repeated calls` | ✅ COMPLIANT |
| Trap Registration | Unregister removes all listeners | `… > installCleanupTrap > unregister removes only the listeners it added` | ✅ COMPLIANT |

### branch-picker (4 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Prefer Explicit Input | Explicit branch returned when valid | `src/core/branch-picker.test.ts > pickBranch > returns the explicit branch when valid and skips the prompt` | ✅ COMPLIANT |
| Prefer Explicit Input | Unknown surfaces did-you-mean | `… > throws BranchNotFoundError with did-you-mean suggestions for unknown explicit` | ✅ COMPLIANT |
| Interactive Selection | Returns the picked branch | `… > returns the picked branch via prompt` | ✅ COMPLIANT |
| Interactive Selection | Cancel returns null | `… > returns null when the user cancels the prompt` | ✅ COMPLIANT |

### run-command (10 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Config Required | Missing config fails fast | `src/core/run-flow.test.ts > runFlow > missing config throws RunFlowError(no-config)` | ✅ COMPLIANT |
| Branch Resolution | Positional wins over prompt | `… > happy path: --yes runs install + hooks + spawn and cleans up` (uses positional, no prompt called) | ✅ COMPLIANT |
| Mode Resolution | --mode wins over prompt | Same happy-path test (mode passed explicitly, no prompt) | ✅ COMPLIANT |
| Port Verification | Fixed and busy aborts | `… > port-busy on fixed throws RunFlowError(port-busy) with holder` | ✅ COMPLIANT |
| Port Verification | auto-find skips busy | `… > auto-find skips busy and uses next free port` | ✅ COMPLIANT |
| Worktree Lifecycle | Pre-spawn failure cleans up | `… > install-failed cleans up the worktree and throws RunFlowError(install-failed)` + `… > hook-failed cleans up and throws RunFlowError(hook-failed, failedAt)` | ✅ COMPLIANT |
| Cleanup On Exit | Ctrl+C removes the worktree | Pure cleanup handler unit-tested (idempotency + --keep guard); trap registration unit-tested; runtime path composed in `runFlow` | ⚠️ PARTIAL — full SIGINT-end-to-end deferred |
| Cleanup On Exit | --keep preserves the worktree | `… > --keep with existing worktree+node_modules skips create and install` (and `removeCalls.length === 0`) | ✅ COMPLIANT |
| Concurrent Invocation Lock | Refuses concurrent run | `… > peel.lock with live PID throws RunFlowError(locked)` | ✅ COMPLIANT |
| (extra) Branch not found | Suggestions surfaced | `… > branch-not-found throws RunFlowError(branch-not-found, suggestions)` | ✅ COMPLIANT |
| (extra) Cancel mid-picker | Exits 0 without side effect | `… > cancel mid-picker exits 0 without creating a worktree` | ✅ COMPLIANT |

**Compliance summary**: **27 / 29** scenarios COMPLIANT, **2** PARTIAL — both documented and acceptable:
- `runner-port: Run Captures Output` — `Runner.run` contract is asserted by `FakeRunner` tests and exercised end-to-end by the integration test (the install command flows through the real `ExecaRunner.run`). A dedicated unit test for `ExecaRunner.run` capturing real stderr is a follow-up.
- `run-command: Cleanup On Exit / Ctrl+C` — full SIGINT integration deferred; the cleanup logic is unit-tested and `runFlow` does install the trap and forward SIGINT to the child.

No CRITICAL failures. No untested scenarios.

---

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| `Runner` port + execa adapter + Fake | ✅ | Mirrors `Prompter` pattern from peel-init |
| Pure `buildCleanupHandler` + thin `installCleanupTrap` | ✅ | Both unit-tested; trap returns `unregister()` for test isolation |
| clack `select` picker (no fuzzy) | ✅ | TODO marker in `branch-picker.ts` for follow-up fuzzy |
| `peel.lock` w/ PID + `process.kill(pid, 0)` for staleness | ✅ | `isProcessAlive` helper |
| `RunFlowError` w/ kind enum | ✅ | All seven kinds present and switched on in `formatRunFlowError` |
| Install logs → `os.tmpdir()/peel-install-<ts>-<pid>.log` | ✅ | Path encoded in `installer.ts` |
| Pre-spawn failure → cleanup before throw | ✅ | `install-failed` and `hook-failed` paths both call `cleanup()` |
| `--keep` reuse skips both create AND install | ✅ | `reuse` boolean gate in `runFlow` |
| commander wiring with positional + flags | ✅ | All six flags + 2 positionals |
| Existing-worktree-but-no-node_modules behavior | ⚠️ Deviated | Design said "always create when not reusing"; impl skips `createWorktree` if path exists (avoids leftover-dir collisions). Acceptable per PRD §9.10 spirit. |
| Integration test stub via fake-dev `.peel.yml` | ⚠️ Deviated | Used `port.base: 38000` instead of design's `0` because schema requires positive. No behavior impact. |
| Full SIGINT integration test | ⚠️ Deviated | Deferred to a follow-up; cleanup logic is unit-tested and the trap is wired in `runFlow`. |

All deviations are documented in apply-progress and re-validated here as acceptable.

---

## File Inventory vs Design

| File | Expected | Present | Status |
|---|---|---|---|
| `src/ports/runner.ts` | New | Yes | ✅ |
| `src/ui/runner-execa.ts` | New | Yes | ✅ |
| `src/core/__fixtures__/fake-runner.ts` (+ test) | New | Yes | ✅ |
| `src/core/env-copy.ts` (+ test) | New | Yes | ✅ |
| `src/core/installer.ts` (+ test) | New | Yes | ✅ |
| `src/core/hooks.ts` (+ test) | New | Yes | ✅ |
| `src/core/branch-picker.ts` (+ test) | New | Yes | ✅ |
| `src/core/cleanup.ts` (+ test) | New | Yes | ✅ |
| `src/core/run-flow.ts` (+ test) | New | Yes | ✅ |
| `src/commands/run.ts` (+ test) | New | Yes | ✅ |
| `src/index.ts` | Modified | Yes (run subcommand registered) | ✅ |
| `src/ui/banner.ts` | Modified | Yes (4 new formatters + types) | ✅ |
| `test/run.integration.test.ts` | New | Yes | ✅ |
| `README.md` | Modified | Yes (Run a branch section) | ✅ |

---

## Issues Found

**CRITICAL** (must fix before archive):
None.

**WARNING** (should fix):
None. All deviations are documented and acceptable.

**SUGGESTION** (nice to have):
1. Add a follow-up "harden cleanup" change with a real SIGINT integration test (spawn sleeping fake-dev, send SIGINT to parent, assert worktree removed).
2. Add a unit test for `ExecaRunner.run` that captures stdout/stderr separately (the integration test exercises it indirectly).
3. Consider relaxing `port.base` schema to allow `0` if there's a use case for OS-assigned ports (currently rejected).
4. `commands/run.ts` `runCommand` itself is not directly unit-tested; only `formatRunFlowError` is. The function is mostly wiring, but a small smoke test would close the loop.
5. Add `@vitest/coverage-v8` once `peel list` / `peel clean` lands so we can enforce a per-file threshold.

---

## Verdict

✅ **PASS**

All gates green (lint, typecheck, build, 145/145 tests). 27/29 spec scenarios COMPLIANT + 2 PARTIAL (acceptable, both documented). TDD evidence complete. Three documented deviations from design, all justified. Ready to commit, push, open PR.
