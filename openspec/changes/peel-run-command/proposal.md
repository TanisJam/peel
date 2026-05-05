# Proposal: peel run command

## Intent

Ship the headline feature of the CLI. `peel run [branch] [mode]` composes the four primitives from PR #3 plus seven new modules to deliver the full PRD §6.2 flow: load config, fetch, pick branch, pick mode, verify port, create worktree, copy env, install, run hooks, banner, spawn dev/build with cleanup-on-exit. Without this, `peel` only generates a config — the actual value is unreachable.

## Scope

### In Scope
- `peel run [branch] [mode]` subcommand with flags `--keep`, `--mode`, `--port`, `--no-fetch`, `--branch`, `--yes`.
- `env-copy`, `installer`, `pre-run-hooks`, `branch-picker`, `cleanup-trap`, `run-command` modules.
- `Runner` port (mirrors `Prompter` pattern) with `FakeRunner` for unit tests + execa adapter for production.
- Friendly error UX per PRD §8.2: port-busy with `whoHoldsPort` info, branch-not-found with did-you-mean, install-failure with last 30 lines + log path.
- `--keep` reuses existing worktree without reinstall when `node_modules` is already present (PRD §9.10).
- `peel.lock` file in worktree blocks concurrent invocations on same branch (PRD §9.13).
- Strict TDD: `runFlow(deps)` orchestrator unit-tested with `FakePrompter` + `FakeRunner`. One integration test that spawns a fake-dev-server `.peel.yml` and verifies the full pipe.

### Out of Scope
- Fuzzy filter on the picker (PRD §8.1 mentions; defer to a follow-up). Plain `select` for now with a TODO.
- `peel list`, `peel clean`, `peel config` subcommands — separate changes.
- Windows native support (PRD §3).
- Concurrent worktree management UI / dashboard (PRD §14).
- Slack / hook-after-cleanup notifications (PRD §14).
- Auto-monorepo workspace detection (PRD §14).

## Capabilities

### New Capabilities
- `env-copy`: copy env files from main repo to worktree, skip existing, report missing.
- `installer`: run install command in worktree, capture log on failure.
- `pre-run-hooks`: run an ordered list of hooks; stop on first failure.
- `runner-port`: process spawning interface for short-lived (`run`) and long-lived (`spawn`) commands; pluggable adapter for testing.
- `cleanup-trap`: pure cleanup handler + thin SIGINT/SIGTERM/exit registrar; honors `--keep`; idempotent.
- `branch-picker`: prompt-driven branch selection from a `Branch[]` list.
- `run-command`: the `peel run` orchestration capability; the user-visible flow per PRD §6.2.

### Modified Capabilities
None.

## Approach

Single `runFlow(deps): Promise<ExitCode>` function that walks PRD §6.2 steps 1-13 with explicit deps. Bottom-up: env-copy → installer → hooks → Runner port + Fake → cleanup pure handler → branch-picker → run-flow → banner extensions → commands/run.ts → CLI wiring → integration test. All unit tests use real fs / real net via `tmp-promise` + `FakePrompter`/`FakeRunner`; no mocks.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/core/{env-copy,installer,hooks,branch-picker,cleanup,run-flow}.ts` (+ tests) | New | One module per capability |
| `src/ports/runner.ts` | New | `Runner` interface + `RunnerError` |
| `src/ui/runner-execa.ts` | New | execa-backed `Runner` adapter |
| `src/core/__fixtures__/fake-runner.ts` | New | Test fake |
| `src/commands/run.ts` (+ test) | New | CLI handler |
| `src/index.ts` | Modified | Register `run` subcommand |
| `src/ui/banner.ts` | Modified | `runBanner`, `formatPortBusy`, `formatBranchNotFound`, `formatInstallFailure` |
| `test/run.integration.test.ts` | New | End-to-end with fake dev server in `.peel.yml` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Long-running spawn pollutes test runner | Med | All unit tests use `FakeRunner`; integration test uses a `.peel.yml` whose `dev` exits 0 |
| Signal handler leak across tests | Low | Trap module returns `unregister()`; tests call it in afterEach |
| `--keep` reuse vs corrupt previous state | Low | If `node_modules` exists, skip install with a warn; user can `peel clean <branch>` |
| `peel.lock` stale lock from a crashed prior run | Low | Lock file contains PID; on read, check `process.kill(pid, 0)`; remove if dead |

## Rollback Plan

Single-PR change. Revert merge commit. Existing `peel init` and primitives are untouched.

## Dependencies

No new runtime deps (`execa` already installed).

## Success Criteria

- [ ] `peel run feature/x dev --yes` end-to-end runs against a fixture repo and exits 0.
- [ ] `peel run` interactive flow completes via `FakePrompter` in unit tests.
- [ ] Cancel mid-picker exits 0 with no worktree created.
- [ ] Port-busy on `fixed` strategy prints PID + suggested kill command.
- [ ] Port `auto-find` strategy picks the next free port within 20.
- [ ] Cleanup trap removes the worktree on SIGINT (verified by an integration test using a fake sleeping process).
- [ ] `--keep` skips cleanup AND skips reinstall when `node_modules` exists.
- [ ] CI matrix green on Node 20 + 22 × ubuntu + macos.
