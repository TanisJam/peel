# Design: peel-list-clean

## Technical Approach

Composes existing primitives (`listWorktrees`, `removeWorktree`, `listBranches`, `loadConfig`, `getRepoName`, `findGitRoot`) plus three new pure helpers in `core/worktree-filter.ts`. Two orchestrators (`core/list-flow.ts`, `core/clean-flow.ts`) implement the spec scenarios; thin command wrappers wire real adapters and hand off to banner formatters. Mirrors the `runFlow` ports & adapters layering established in `peel-run-command`.

## Architecture Decisions

### Decision: `peel.lock` for status detection (not port probing)

**Choice**: Use `peel.lock` + `process.kill(pid, 0)` (already proven in `runFlow`).
**Alternatives**: PRD-suggested port-holder cwd inspection.
**Rationale**: Cross-platform `cwd-of-pid` requires `/proc/<pid>/cwd` (Linux) or `lsof -d cwd` (macOS) — fragile. `peel.lock` is already written; `isProcessAlive` is already battle-tested.

### Decision: Single-target clean proceeds with warning; bulk modes skip running

**Choice**: `peel clean <branch>` warns + removes; `--all`/`--stale` skip running with summary entry.
**Alternatives**: (A) Always force; (B) Always block.
**Rationale**: Single target is explicit user intent — they typed the branch. Bulk is "do the safe thing" — a swept dev-server kill is destructive and hard to undo.

### Decision: Three flow files (filter helpers / list-flow / clean-flow), not one mega-flow

**Choice**: `core/worktree-filter.ts` (pure, sync) + `list-flow.ts` (read-only) + `clean-flow.ts` (mutating, three modes).
**Alternatives**: One `manage-flow.ts` with a mode dispatch.
**Rationale**: List is read-only; clean mutates. Different prompts, different errors. Separate flows are easier to TDD, and the helpers stay reusable.

### Decision: `--yes` does NOT override running-skip in bulk modes

**Choice**: `-y` only suppresses the confirmation prompt, not the running-safety guard.
**Rationale**: `-y` semantics in `peel run` and `peel init` mean "use defaults, don't prompt". Forcing destruction of a live server is a different escalation. If users ever need it, a future `--force` flag is the right knob — not overloading `-y`.

## Data Flow

```
peel list:
  loadConfig + findGitRoot ──→ listWorktrees ──→ filterToolWorktrees
                                                       │
                                                       ▼
                          getWorktreeStatus + getWorktreeAge → rows
                                                                │
                                                                ▼
                                                       formatWorktreeTable

peel clean <mode>:
  loadConfig ──→ listWorktrees ──→ filterToolWorktrees ──→ filter(mode)
                                                                  │
                                            ┌─────── confirm? ────┤
                                            ▼                     ▼
                              (skip running in bulk) ──→ removeWorktree → summary
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/core/worktree-filter.ts` | Create | `filterToolWorktrees`, `getWorktreeStatus`, `getWorktreeAge`, `formatAge` |
| `src/core/worktree-filter.test.ts` | Create | Pure helper tests with `tmp-promise` for fs |
| `src/core/list-flow.ts` | Create | `listFlow(deps) → ListFlowResult` |
| `src/core/list-flow.test.ts` | Create | Real-fs flow tests |
| `src/core/clean-flow.ts` | Create | `cleanFlow(deps) → CleanFlowResult` |
| `src/core/clean-flow.test.ts` | Create | Real-fs flow tests with FakePrompter |
| `src/commands/list.ts` | Create | `runListCommand({cwd}) → {exitCode, message}` |
| `src/commands/list.test.ts` | Create | Wiring + formatter selection |
| `src/commands/clean.ts` | Create | `runCleanCommand({cwd, mode, branch?, yes, noFetch})` |
| `src/commands/clean.test.ts` | Create | Wiring + formatter selection |
| `src/ui/banner.ts` | Modify | Add `formatWorktreeTable`, `formatCleanSummary`, `formatNoWorktrees`, `formatRunningWarning` |
| `src/ui/banner.test.ts` | Modify | Tests for each new formatter |
| `src/index.ts` | Modify | Register `list` and `clean [branch]` subcommands |
| `test/list-clean.integration.test.ts` | Create | End-to-end via shared fixture |
| `README.md` | Modify | "Manage worktrees" section |

## Interfaces / Contracts

```ts
// worktree-filter.ts
export type WorktreeStatus = "running" | "idle" | "unknown";

export function filterToolWorktrees(
  all: Worktree[],
  ctx: { repoRoot: string; baseDir: string; repoName: string },
): Worktree[];

export function getWorktreeStatus(path: string): WorktreeStatus;
export function getWorktreeAge(path: string): number; // ms
export function formatAge(ms: number): string;

// list-flow.ts
export type ListRow = {
  branch: string;
  path: string;
  ageMs: number;
  status: WorktreeStatus;
};
export type ListFlowResult = { rows: ListRow[] };
export async function listFlow(deps: ListFlowDeps): Promise<ListFlowResult>;

// clean-flow.ts
export type CleanMode = "single" | "all" | "stale";
export type CleanFlowArgs = {
  mode: CleanMode;
  branch?: string;
  yes: boolean;
  noFetch: boolean;
};
export type CleanFlowOutcome =
  | { kind: "removed"; branch: string }
  | { kind: "skipped-running"; branch: string }
  | { kind: "skipped-not-tool"; branch: string };
export type CleanFlowResult = {
  cancelled?: boolean;
  outcomes: CleanFlowOutcome[];
};

export type CleanFlowErrorKind = "no-config" | "branch-not-found";
export class CleanFlowError extends Error {
  constructor(message: string, public readonly kind: CleanFlowErrorKind);
}

export async function cleanFlow(deps: CleanFlowDeps): Promise<CleanFlowResult>;
```

Both flows accept a `RunFlowOps`-style `ops` bag (subset: `loadConfig`, `findGitRoot`, `getRepoName`, `listWorktrees`, `removeWorktree`, `listBranches`, `gitFetch`, `worktreePath`) so tests inject fakes; `commands/*.ts` pass real impls from `core/*` modules.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit (helpers) | filter rules, status detection, age formatting | `tmp-promise` real fs; write/delete `peel.lock` |
| Unit (flows) | each spec scenario for list + clean | `tmp-promise` git fixture + `FakePrompter`; real `listWorktrees`/`removeWorktree` against the bare/clone fixture |
| Integration | end-to-end via built `dist/index.js` | Shared `git-fixture.ts`; create a tool worktree via `peel run --keep` then assert `peel list` rows; assert `peel clean <branch>` removes it |

## Migration / Rollout

No migration required. New subcommands; default `peel` action unchanged.

## Open Questions

None.
