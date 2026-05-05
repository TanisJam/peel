# Exploration: peel-run-command

> Wire the four primitives from PR #3 plus several new ones into the `peel run [branch] [mode]` CLI subcommand. This is the headline feature of the tool.

## Current State

After PR #3, `src/core/{config-load,git,worktree,port}.ts` are battle-tested primitives. There is **no** `peel run` command, no env-copy logic, no install runner, no process-spawning abstraction, no cleanup trap. `src/index.ts` registers `init` but has no `run` subcommand. The `Prompter` port from peel-init is reusable for the picker.

PRD refs: §6.2 (the run flow steps 1-13), §8.1 (UX/banner), §8.2 (port-busy error shape with `whoHoldsPort`), §9 (edge cases — Ctrl+C cleanup, port range, --keep reuse).

## Affected Areas

- `src/core/env-copy.ts` — **new**. Copy env files from main repo to worktree; skip if already present.
- `src/core/installer.ts` — **new**. Run install command with execa, capture log on failure.
- `src/core/hooks.ts` — **new**. Run pre-run hooks sequentially; stop on first failure.
- `src/ports/runner.ts` — **new**. `Runner` interface — abstraction over execa for both short-lived (`run`) and long-lived (`spawn`) processes; fake-able for tests.
- `src/ui/runner-execa.ts` — **new**. Real `Runner` adapter using execa with stdio inherit + signal forwarding for `spawn`.
- `src/core/__fixtures__/fake-runner.ts` — **new**. `FakeRunner` for unit tests; scripts exit codes per call; never spawns real processes.
- `src/core/cleanup.ts` — **new**. Pure `buildCleanupHandler(deps)` returning a function suitable for SIGINT/SIGTERM/exit; tests cover the function directly. Trap registration is a thin module that the orchestrator calls.
- `src/core/branch-picker.ts` — **new**. Given `Branch[]`, prompts for selection via `Prompter`. Reuses existing port. (Fuzzy filter DEFERRED — PRD §8.1 leaves this open.)
- `src/core/run-flow.ts` — **new**. Pure orchestrator function `runFlow(deps): Promise<ExitCode>` that takes Prompter + Runner + Logger and walks all 13 PRD steps. The CLI handler wires real adapters; tests wire fakes.
- `src/commands/run.ts` — **new**. Thin command handler — parses CLI args + flags, builds deps, calls `runFlow`, maps errors to friendly messages.
- `src/ui/banner.ts` — **modify**. Add `runBanner({ branch, path, mode, url, autoCleanup })` printer and `formatPortBusy({port, holder})` per PRD §8.2.
- `src/index.ts` — **modify**. Register `run` subcommand with positional args + flags.
- `src/commands/init.ts` — **no change**.
- Tests: per-module unit + 1 end-to-end integration test that uses `FakeRunner` (so we can `peel run feature/x dev` against the shared fixture without spawning a real dev server).

## Approaches

### Decision 1 — Process-spawning abstraction

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **`Runner` port + fake** (mirrors Prompter pattern from peel-init) | Orchestrator unit-testable end-to-end; we can assert the *order* of install → hooks → spawn; signal handling is testable in isolation | Two new files (port + adapter) | Low |
| Pass execa around directly | Less ceremony | Can't test orchestration without spawning real processes | Low |
| Mock execa via `vi.mock` | Familiar | Couples tests to execa internals; PRD says no mocks for primitive layers, this stays consistent | Low |

**Recommendation: `Runner` port + fake.** Same pattern that worked for peel-init's `Prompter`. Crucial for keeping the Strict TDD cycle fast on the orchestrator.

### Decision 2 — Cleanup trap testing

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **Extract `buildCleanupHandler(deps)` as pure function**; the trap module is a 6-line `process.on(...)` registrar | The "what to do on cleanup" is unit-tested directly with fakes; the registration is exercised once in integration | One extra abstraction layer | Low |
| Test signals end-to-end with a child process per test | "Most realistic" | Slow, flaky, hard to assert order | High |

**Recommendation: extract pure handler.** Integration test uses a fake dev server (`node -e "process.on('SIGINT',()=>process.exit(130));setInterval(()=>{},1e3)"`) sent SIGINT to verify the wiring once, but every assertion about cleanup logic happens in unit tests against the pure function.

### Decision 3 — Branch picker UX

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **clack `select` with branch list as labels** (no fuzzy) | Ships now; PRD §8.1 doesn't mandate fuzzy | A long list is harder to navigate | Low |
| Add `fuzzysort` filter via clack `text` + custom render | Matches PRD's "fuzzy picker" mention | More UI work for marginal gain in v0 | High |

**Recommendation: plain `select` for now**, with a `// TODO: fuzzy` next to the picker so the upgrade path is visible. PRD also lists fuzzy as nice-to-have, not required.

### Decision 4 — Orchestrator decomposition

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **One `runFlow(deps)` function with explicit deps object** | Fully unit-testable with fakes; one place to read the flow; matches the PRD §6.2 step list 1-13 | Slightly long function | Medium |
| Many small functions glued in `commands/run.ts` | Each piece tiny | Cross-step assertions become harder | Medium |

**Recommendation: single `runFlow(deps)` function** with deps `{ cwd, args, prompter, runner, configLoader, gitOps, worktreeOps, portOps, cleanup, logger }`. Steps 1-13 from the PRD become a clean linear function body.

### Decision 5 — Error UX shape

PRD §8.2 specifies friendly messages:
- Port busy → run `whoHoldsPort`, format with PID + suggested kill command.
- Branch not found → "did you mean: …?" using simple Levenshtein over the branch list.
- Install failed → last 30 lines of log + path to full log file in `os.tmpdir()`.

All three become small pure helpers in `src/ui/banner.ts` (extending the existing file). Pure functions, easy to test.

## Recommendation

Bottom-up under Strict TDD, in this order:

1. **`env-copy`** — pure, simple, real fs via tmp-promise. Tests: copies missing files, skips existing, reports missing-on-source.
2. **`installer`** — RED test that asserts captured log on failure. Uses `Runner` (or execa directly — small enough that direct is fine). Returns `{ ok, log }`.
3. **`hooks`** — sequential runner using `Runner` port. RED for happy + failure-stops-rest scenarios.
4. **`Runner` port + `FakeRunner`** — interface, fake with scripted exit codes/stdout. Real adapter (`src/ui/runner-execa.ts`) is one-shot wired and integration-tested only.
5. **`cleanup` (pure handler)** — `buildCleanupHandler({ worktreeOps, repoRoot, worktreePath, keep, logger })` returns a function that's a no-op when `keep=true`, calls `removeWorktree` otherwise. Idempotent (only fires once even if multiple signals arrive).
6. **`branch-picker`** — small wrapper over `Prompter.select`. Test with `FakePrompter`.
7. **`run-flow`** — orchestrator. RED tests drive the happy path, the cancel-mid-picker path, the port-busy path, the branch-not-found path. All with FakePrompter + FakeRunner.
8. **`banner` extensions** — `runBanner`, `formatPortBusy`, `formatBranchNotFound` (with did-you-mean), `formatInstallFailure`. Pure formatters with unit tests.
9. **`commands/run.ts`** — thin handler: parses CLI args/flags, instantiates real adapters, calls `runFlow`, maps `RunFlowError` to friendly output.
10. **`src/index.ts`** — register the `run` subcommand.
11. **Integration test** — spawn `node dist/index.js run feature/x dev --keep` against the shared git fixture; assert exit 0 (using a fake "dev server" command in the .peel.yml that prints a banner and exits 0).

## Risks

1. **Long-running spawning in integration** — true dev server doesn't exit. Mitigation: integration test uses a `.peel.yml` with `dev: "node -e \"console.log('ready');process.exit(0)\""`. The full SIGINT flow is exercised by the unit test on the cleanup handler, plus one targeted integration test that spawns a sleeping fake and sends SIGINT.
2. **Signal handler leaks across tests** — registering `process.on('SIGINT', ...)` in a unit test would persist. Mitigation: trap module returns an `unregister()` function; tests always call it in afterEach.
3. **`--keep` semantics on existing worktree** — PRD §9.10: reuse, do not reinstall if `node_modules` exists. Adds a "reuse path" branch in `runFlow`. Cover with one extra unit scenario.
4. **Cross-platform env file copy** — paths only matter on macOS/Linux per PRD; use `node:fs.copyFile`. Standard.
5. **Pre-run hook stdio** — should hooks inherit stdio so the user sees prisma migration logs? PRD §6.2 step 10 implies yes. Decision: hooks inherit stdio via Runner.spawn, dev/build command also inherits via Runner.spawn. install captures (so we can show the log on failure).
6. **Banner UTF-8 width on Windows** — out of MVP scope.

## Ready for Proposal

**Yes.** All five decisions are firm. The capability list for the proposal is clear: 7 NEW capabilities (`env-copy`, `installer`, `pre-run-hooks`, `runner-port`, `cleanup-trap`, `branch-picker`, `run-command`). One MODIFIED (`init-command` is unchanged; we won't list it). Tell the user: "Explore done — single `runFlow(deps)` orchestrator with Runner port + fake; pure cleanup handler; clack select picker (fuzzy deferred); friendly error UX in banner. Moving to proposal."
