# Design: peel run command

## Technical Approach

Single `runFlow(deps)` orchestrator walks PRD §6.2 steps 1-13 with explicit dependencies. Every external interaction (subprocess, prompt, fs cleanup) is behind a port — Prompter (existing), Runner (new), worktreeOps (existing). Production wires execa + clack adapters; tests wire `FakePrompter` + `FakeRunner` so the orchestrator is unit-testable end-to-end. Cleanup is a pure handler returned by `buildCleanupHandler` and registered via a thin `installCleanupTrap`.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Subprocess abstraction | `Runner` port + execa adapter + Fake | Same pattern that worked for Prompter; orchestrator unit-testable |
| Cleanup | Pure handler + thin trap registrar with `unregister()` | Idempotent removal logic is unit-tested; signal wiring exercised once via integration |
| Picker UX | clack `select` (no fuzzy) | PRD §8.1 lists fuzzy as nice-to-have; defer with TODO marker |
| Concurrent invocations | `peel.lock` file with PID; stale via `process.kill(pid, 0)` | PRD §9.13; portable to all UNIX platforms in scope |
| Error surface | `RunFlowError(kind, message, suggestions?)` plus existing `WorktreeError` and new `BranchNotFoundError`, `InstallError` | Lets `commands/run.ts` switch on `kind` to print the right banner without string sniffing |
| Install logs | Capture combined stdout+stderr; persist on failure to `os.tmpdir()/peel-install-<ts>.log`; show last 30 lines | Matches PRD §8.2 example |
| Pre-spawn failure handling | Always remove the freshly-created worktree before exiting non-zero | Avoids zombie worktrees from interrupted setups (PRD §9.6) |
| `--keep` reuse | When the target worktree path already exists AND `node_modules` is present, skip `createWorktree` AND skip `runInstall` | PRD §9.10 |

## File Changes

| File | Action | Notes |
|---|---|---|
| `src/core/env-copy.ts` (+ test) | New | `copyEnvFiles` |
| `src/core/installer.ts` (+ test) | New | `runInstall` with capture and skipIfNodeModules |
| `src/core/hooks.ts` (+ test) | New | `runHooks` sequential w/ failure stop |
| `src/core/branch-picker.ts` (+ test) | New | `pickBranch` + `BranchNotFoundError` |
| `src/core/cleanup.ts` (+ test) | New | `buildCleanupHandler` + `installCleanupTrap` |
| `src/core/run-flow.ts` (+ test) | New | `runFlow(deps): Promise<RunFlowResult>` |
| `src/ports/runner.ts` | New | `Runner` interface + `RunHandle` |
| `src/ui/runner-execa.ts` | New | execa-backed Runner adapter |
| `src/core/__fixtures__/fake-runner.ts` | New | Test fake |
| `src/commands/run.ts` (+ test) | New | CLI handler; commander glue; error→banner map |
| `src/index.ts` | Modify | Register `run` subcommand |
| `src/ui/banner.ts` | Modify | Add `runBanner`, `formatPortBusy`, `formatBranchNotFound`, `formatInstallFailure` |
| `test/run.integration.test.ts` | New | spawns `node dist/index.js run feature/x dev --yes --keep` against fixture with fake-dev-server `.peel.yml` |

## Interfaces / Contracts

```ts
// src/ports/runner.ts
export type RunResult = { exitCode: number; stdout: string; stderr: string };
export type SpawnHandle = {
  exited: Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>;
  kill(signal?: NodeJS.Signals): boolean;
};
export interface Runner {
  run(args: { command: string; cwd: string; signal?: AbortSignal }): Promise<RunResult>;
  spawn(args: { command: string; cwd: string }): SpawnHandle;
}
```

```ts
// src/core/env-copy.ts
export type EnvCopyResult = { copied: string[]; skipped: string[]; missing: string[] };
export function copyEnvFiles(args: { src: string; dest: string; files: string[] }): Promise<EnvCopyResult>;
```

```ts
// src/core/installer.ts
export type InstallResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; log: string; logPath: string };
export function runInstall(args: {
  runner: Runner; cwd: string; command: string; skipIfNodeModules?: boolean;
}): Promise<InstallResult>;
```

```ts
// src/core/hooks.ts
export type HooksResult =
  | { ok: true }
  | { ok: false; failedAt: number; command: string; exitCode: number };
export function runHooks(args: { runner: Runner; cwd: string; hooks: string[] }): Promise<HooksResult>;
```

```ts
// src/core/branch-picker.ts
export class BranchNotFoundError extends Error {
  constructor(message: string, public suggestions: string[]) { super(message); }
}
export function pickBranch(args: {
  prompter: Prompter; branches: Branch[]; explicit?: string;
}): Promise<string | null>;
```

```ts
// src/core/cleanup.ts
export function buildCleanupHandler(deps: {
  removeWorktree: (repoRoot: string, path: string) => Promise<unknown>;
  repoRoot: string; worktreePath: string; keep: boolean; logger?: Logger;
}): () => Promise<void>;
export function installCleanupTrap(handler: () => Promise<void>): () => void; // unregister
```

```ts
// src/core/run-flow.ts
export type RunFlowDeps = {
  cwd: string;
  args: { branch?: string; mode?: "dev"|"build"; keep: boolean; port?: number; noFetch: boolean; yes: boolean };
  prompter: Prompter; runner: Runner;
  configLoader: typeof loadConfig; gitOps: { fetch, listBranches, getRepoName, findGitRoot };
  worktreeOps: { create, remove, list }; portOps: { isBusy, findFree, whoHolds };
  logger: Logger;
};
export type RunFlowResult = { exitCode: number };
export class RunFlowError extends Error {
  constructor(message: string, public kind: "no-config"|"port-busy"|"branch-not-found"|"install-failed"|"hook-failed"|"locked"|"cancelled", public detail?: unknown) { super(message); }
}
export function runFlow(deps: RunFlowDeps): Promise<RunFlowResult>;
```

## Data Flow (happy path)

```
load .peel.yml  ──► (optional) git fetch  ──► list branches
                                               │
                                               ▼
        positional / --branch / interactive  ─► branch resolved
                                               │
        positional / --mode / interactive  ──► mode resolved
                                               │
                                               ▼
            verify port (fixed | auto-find) ─► port resolved
                                               │
                                               ▼
        compute worktree path → check `peel.lock` → create worktree
                                               │
                                               ▼
            copy env files → install (skip if --keep+node_modules)
                                               │
                                               ▼
                              run pre-run hooks
                                               │
                                               ▼
        register cleanup trap → print banner → spawn dev/build
                                               │
                                               ▼
                            child exits → unregister trap → cleanup
```

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit — modules | env-copy / installer / hooks / branch-picker / cleanup | tmp-promise + FakeRunner + FakePrompter |
| Unit — orchestrator | full runFlow happy + cancel + port-busy + install-failed + hook-failed + --keep reuse + locked | All deps faked; no real subprocess; assert `RunFlowResult` and side-effects on the FakeRunner |
| Unit — banner | port-busy / branch-not-found / install-failed formatters | Pure string assertions |
| Integration | end-to-end `peel run feature/x dev --yes --keep` | fixture repo with `.peel.yml` whose `dev` is `node -e "console.log('ready');process.exit(0)"`. Spawns built `dist/index.js`. Asserts exit 0 and printed banner. |
| Integration — SIGINT | trap fires and removes worktree | spawn a sleeping node child via real Runner; deliver SIGINT to the parent; assert worktree removed |

## Migration / Rollout

No migration. New files only plus banner extensions. Existing `peel init` untouched.

## Open Questions

None. Fuzzy picker explicitly deferred via TODO.
