# Tasks: peel run command

> Strict TDD active. Real fs, real net, real git via `tmp-promise`. No mocks. `FakeRunner` and `FakePrompter` are fakes (scripted), not mocks.

## Phase 1: Runner Port + Fake + Adapter

- [x] 1.1 RED: `src/core/__fixtures__/fake-runner.test.ts` — assert `FakeRunner.scriptRun(results[])` returns scripted `{exitCode, stdout, stderr}` per call; `scriptSpawn(handles[])` returns scripted `{exited, kill}`; throws if exhausted.
- [x] 1.2 GREEN: `src/ports/runner.ts` (`Runner` interface, `RunResult`, `SpawnHandle`) + `src/core/__fixtures__/fake-runner.ts`.
- [x] 1.3 `src/ui/runner-execa.ts` — execa-backed adapter (no unit tests; integration test covers it).

## Phase 2: env-copy

- [x] 2.1 RED: `src/core/env-copy.test.ts` — copies present, skips existing, reports missing (REQ Copy Files / scenario 1); empty list no-op (scenario 2).
- [x] 2.2 GREEN: `src/core/env-copy.ts` — `copyEnvFiles({src, dest, files})`.

## Phase 3: installer

- [x] 3.1 RED: `src/core/installer.test.ts` — happy (exit 0 → `{ok:true}`); failure (exit 1 → `{ok:false, log, logPath}` with file at `os.tmpdir()/peel-install-*.log` containing the captured output); skipIfNodeModules (exists → `{ok:true, skipped:true}`, runner NOT called).
- [x] 3.2 GREEN: `src/core/installer.ts` — `runInstall({runner, cwd, command, skipIfNodeModules?})`.

## Phase 4: hooks

- [x] 4.1 RED: `src/core/hooks.test.ts` — all-pass (REQ scenario 1); stops at first failure (scenario 2); empty list no-op (scenario 3).
- [x] 4.2 GREEN: `src/core/hooks.ts` — `runHooks({runner, cwd, hooks})`.

## Phase 5: branch-picker

- [x] 5.1 RED: `src/core/branch-picker.test.ts` — explicit valid returned + prompter not called; explicit unknown throws `BranchNotFoundError` with did-you-mean suggestions; interactive returns picked; cancel returns null.
- [x] 5.2 GREEN: `src/core/branch-picker.ts` — `pickBranch(...)` + `BranchNotFoundError` (Levenshtein over branch names, top 3 suggestions).

## Phase 6: cleanup

- [x] 6.1 RED: `src/core/cleanup.test.ts` — handler removes worktree on default; `keep:true` skips removeWorktree; idempotent under repeated calls (REQ Build Cleanup Handler).
- [x] 6.2 GREEN: `src/core/cleanup.ts` — `buildCleanupHandler(deps)`.
- [x] 6.3 RED: `installCleanupTrap` test — registers SIGINT/SIGTERM/exit; `unregister()` removes only what it added (count process listeners before+after).
- [x] 6.4 GREEN: `installCleanupTrap` — return `unregister()`.

## Phase 7: banner extensions

- [x] 7.1 RED: `src/ui/banner.test.ts` — `formatPortBusy({port, holder?})` includes PID + suggested kill command when holder given; generic message otherwise. `formatBranchNotFound({name, suggestions})` lists suggestions. `formatInstallFailure({log, logPath, lastN=30})` shows last 30 lines + path. `runBanner({branch, path, mode, url, autoCleanup})` includes all fields.
- [x] 7.2 GREEN: `src/ui/banner.ts` — add the four formatters as pure functions.

## Phase 8: run-flow orchestrator

- [x] 8.1 RED: `src/core/run-flow.test.ts` happy path — config + branches + port free + worktree create + env copy + install ok + hooks ok + spawn exits 0 → `RunFlowResult.exitCode === 0`; cleanup called.
- [x] 8.2 GREEN: `src/core/run-flow.ts` — minimum impl to pass.
- [x] 8.3 RED: cancel-mid-picker → exitCode 0, no worktree creation calls. GREEN.
- [x] 8.4 RED: port-busy on `fixed` → throws `RunFlowError(kind:"port-busy")` with holder; no worktree. GREEN.
- [x] 8.5 RED: port-busy on `auto-find` → picks next free; succeeds. GREEN.
- [x] 8.6 RED: install-failed → cleanup runs, throws `RunFlowError(kind:"install-failed")`. GREEN.
- [x] 8.7 RED: hook-failed → cleanup runs, throws `RunFlowError(kind:"hook-failed", failedAt)`. GREEN.
- [x] 8.8 RED: `--keep` reuse → existing worktree+`node_modules` skips both create+install. GREEN.
- [x] 8.9 RED: `peel.lock` with live PID → throws `RunFlowError(kind:"locked", pid)`. Stale PID → overwrites. GREEN.
- [x] 8.10 RED: branch-not-found → throws `RunFlowError(kind:"branch-not-found", suggestions)`. GREEN.

## Phase 9: commands/run.ts

- [x] 9.1 RED: `src/commands/run.test.ts` — wires real adapters + maps each `RunFlowError.kind` to the matching banner formatter; exit codes propagated.
- [x] 9.2 GREEN: `src/commands/run.ts` — `runCommand(opts)` building deps + calling `runFlow` + catching `RunFlowError`.

## Phase 10: src/index.ts wiring

- [x] 10.1 Register `run [branch] [mode]` subcommand with flags `-k/--keep`, `--mode`, `--port`, `--no-fetch`, `-b/--branch`, `-y/--yes`. Existing init tests + smoke must stay green.

## Phase 11: integration

- [x] 11.1 RED: `test/run.integration.test.ts` — fixture with `.peel.yml` whose `dev` is `node -e "console.log('ready');process.exit(0)"`. `peel run feature/x dev --yes --keep` exits 0; banner contains `feature/x`.
- [x] 11.2 RED: SIGINT integration — fixture with sleeping fake dev (`node -e "setInterval(()=>{},1e3)"`); spawn `peel run feature/x dev --yes`; after stdout shows banner, send SIGINT to parent; assert worktree no longer exists when child exits.
- [x] 11.3 GREEN: `npm run build && npm run test:integration` passes both.

## Phase 12: docs + gates

- [x] 12.1 README — append "Run a branch" section showing `peel run feature/x dev` and `peel run feature/x dev --keep`.
- [x] 12.2 `npm run prepublishOnly` end-to-end — green.
- [x] 12.3 `git status` final review — no stray tmp files / lock files.
