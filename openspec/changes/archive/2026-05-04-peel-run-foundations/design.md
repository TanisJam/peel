# Design: peel-run-foundations

## Technical Approach

Four pure-ish modules under `src/core/` (`config-load`, `git`, `worktree`, `port`) shipped bottom-up. `git` and `worktree` shell out via `execa` against a real bare+working repo fixture; `port` uses Node `net` directly; `config-load` is pure parsing layered over the existing schema. `commands/init.ts` is left alone except for one import path swap.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Subprocess wrapper | `execa` | Promise API, structured `stdout`/`stderr`/`exitCode`, easy timeouts; needed again for `peel run` |
| Port detection lib | Roll our own | 12-line loop; `get-port`'s only edge over `net.Server` bind is range search, which we implement explicitly |
| Process-on-port | `lsof` first, `ss` fallback, `null` on failure | Best-effort UX; tests guard with `which lsof` |
| Branch listing | `git for-each-ref --format='%(refname:short)\t%(committerdate:iso8601-strict)' refs/heads refs/remotes/origin` | Single call, dates parseable, dedupe+sort done in JS |
| Fetch error mode | Returns `{ ok, error? }` (never throws) | PRD §9.5 — proceed with local branches when offline |
| Worktree errors | Custom `WorktreeError` with `kind` enum | Lets callers branch on path-conflict vs branch-conflict vs git-error without string matching |
| Test fixture | Real bare repo + working clone via `file://` remote, seeded with 2 branches and 2 commits | PRD §11; one fixture per `describe` (`beforeAll` per suite); always reusable |
| `findGitRoot` location | Move from `commands/init.ts` to `core/git.ts` (single import swap) | Becomes a primitive used by every command going forward |

## File Changes

| File | Action | Notes |
|---|---|---|
| `src/core/config-load.ts` | Create | `loadConfig`, `PeelConfigError` |
| `src/core/git.ts` | Create | `findGitRoot` (moved), `getRepoName`, `currentBranch`, `gitFetch`, `listBranches`, `Branch` type |
| `src/core/worktree.ts` | Create | `slugify`, `worktreePath`, `createWorktree`, `listWorktrees`, `removeWorktree`, `WorktreeError` |
| `src/core/port.ts` | Create | `isPortBusy`, `findFreePort`, `whoHoldsPort` |
| `src/test-utils/git-fixture.ts` | Create | `createGitFixture(): Promise<{ repoRoot, bareRoot, cleanup }>` |
| `src/core/{config-load,git,worktree,port}.test.ts` | Create | Per-module unit tests using the fixture |
| `test/foundations.integration.test.ts` | Create | Crosscut: build → use loadConfig + listBranches + create worktree → remove |
| `src/commands/init.ts` | Modify | `import { findGitRoot } from "../core/git.js"`, drop the local copy |
| `package.json` | Modify | + `execa` runtime |

## Interfaces / Contracts

```ts
// src/core/config-load.ts
export class PeelConfigError extends Error {
  constructor(message: string, public readonly kind:
    | "not-found" | "malformed-yaml" | "schema-invalid", public readonly path?: string) { super(message); }
}
export function loadConfig(cwd: string): Config | null; // throws PeelConfigError on failure
```

```ts
// src/core/git.ts
export type Branch = { name: string; isRemote: boolean; committerDate: Date };
export function findGitRoot(start: string): string | null;
export function getRepoName(repoRoot: string): string;
export function currentBranch(repoRoot: string): string | null; // null on detached HEAD
export type FetchResult = { ok: true } | { ok: false, error: string };
export function gitFetch(repoRoot: string, opts?: { timeout?: number }): Promise<FetchResult>;
export function listBranches(repoRoot: string, opts?: { exclude?: string[] }): Promise<Branch[]>;
```

```ts
// src/core/worktree.ts
export type Worktree = { path: string; branch: string | null; head: string };
export class WorktreeError extends Error {
  constructor(message: string, public readonly kind:
    | "path-exists" | "branch-already-checked-out" | "git-error") { super(message); }
}
export function slugify(branch: string): string;
export function worktreePath(args: { repoRoot: string; baseDir: string; repoName: string; branch: string }): string;
export function createWorktree(args: { repoRoot: string; path: string; branch: string }): Promise<void>; // throws WorktreeError
export function listWorktrees(repoRoot: string): Promise<Worktree[]>;
export function removeWorktree(repoRoot: string, path: string): Promise<{ ok: true }>;
```

```ts
// src/core/port.ts
export function isPortBusy(port: number): Promise<boolean>;
export function findFreePort(base: number, range: number): Promise<number | null>;
export type PortHolder = { pid: number; command: string };
export function whoHoldsPort(port: number): Promise<PortHolder | null>;
```

## Algorithms

**`listBranches`** — call `for-each-ref` once; for each row `<short-name>\t<iso-date>`, classify by prefix (`origin/...` → remote). Build `Map<plainName, Branch>` taking the local copy when both exist (local wins). Sort `Array.from(map.values())` by `committerDate` desc; apply `exclude` patterns via `picomatch`-free literal/`*` matching.

**`findFreePort`** — iterate `i = 0..range-1`, return first `base+i` where `isPortBusy(base+i) === false`. Return `null` after exhaustion. `isPortBusy` does `net.createServer().listen(port, '127.0.0.1')` and resolves `false` on `'listening'` (closing the server first), `true` on `EADDRINUSE`, rejects on other errors.

**`whoHoldsPort`** — try `which('lsof')`, run `lsof -i :PORT -P -n -F pcL`; parse the `p<pid>` and `c<cmd>` records. On non-zero or no match, try `ss -lptnH 'sport = :PORT'`. On both failing → `null`.

**`gitFetch`** — `execa('git', ['fetch', '--prune'], { cwd: repoRoot, timeout: opts?.timeout ?? 15_000 })`; catch any error and return `{ ok: false, error: e.shortMessage ?? String(e) }`.

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit — config-load | locate, merge, validate | `tmp-promise` dirs with seeded `.peel.yml` fixtures |
| Unit — git | every primitive against the fixture | shared `createGitFixture()` per suite |
| Unit — worktree | create/list/remove round-trip + conflict | reuse fixture |
| Unit — port | bind-and-probe with real `net.Server` | random high base port per test |
| `whoHoldsPort` | parse against a real listener we control | guard with `await which('lsof')`; skip if absent |
| Integration | end-to-end fixture lifecycle | `test/foundations.integration.test.ts` |

## Migration / Rollout

No migration. Pure additions plus a one-line import refactor in `commands/init.ts`. Existing `peel init` tests stay green.

## Open Questions

None.
