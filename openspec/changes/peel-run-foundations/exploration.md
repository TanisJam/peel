# Exploration: peel-run-foundations

> Build the four primitive modules — config loading, git ops, worktree wrappers, port checking — that the eventual `peel run` command will compose. No user-facing CLI surface in this change; it lays the rails.

## Current State

`peel init` shipped (PR #2) with: zod config schema (`src/core/config-schema.ts`), defaults, write-side (`src/core/config-write.ts`), detect helpers, the `init-wizard`, and `findGitRoot` baked into `src/commands/init.ts`. There is no read-side for the config, no git operations beyond a directory-existence check, and no worktree or port code at all. `execa` and `get-port` from PRD §10 are NOT installed yet.

Refs: `peel-cli-prd.md` §6.2 (run flow), §7 (config), §8.2 (port-busy UX), §9 (edge cases), §10 (lib picks), §11 (testing — real git via `tmp-promise`).

## Affected Areas

- `src/core/config-load.ts` — **new**. Locate `.peel.yml`, parse, deep-merge with defaults, validate.
- `src/core/git.ts` — **new**. `findGitRoot` (moved from `commands/init.ts`), `gitFetch`, `listBranches`, `getRepoName`, `currentBranch`.
- `src/core/worktree.ts` — **new**. `slugify`, `worktreePath`, `createWorktree`, `listWorktrees`, `removeWorktree`.
- `src/core/port.ts` — **new**. `isPortBusy`, `findFreePort`, `whoHoldsPort`.
- `src/commands/init.ts` — **modify**. Replace inline `findGitRoot` with the import from `core/git.ts`.
- `package.json` — **modify**. Add runtime deps `execa`. (Roll our own port checker — see below.)
- Tests under `src/core/*.test.ts` (unit, real fs, real git, real net) and `test/foundations.integration.test.ts` (full bare-repo workflow).

## Approaches

### Decision 1 — Subprocess wrapper

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **`execa`** | PRD pick; promise API, clean error shape, signal forwarding for later `peel run` | Adds a dep; pulls in `cross-spawn` | Low |
| Native `node:child_process` | Zero dep | Verbose ergonomics, manual stream and signal handling | Medium |

**Recommendation: `execa`.** We will need it again for `peel run` to spawn the dev server with stdio inheritance and signal forwarding. Install once.

### Decision 2 — Port-free detection

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **Roll our own** (Node `net.Server`, bind/unbind) | ~10 lines; zero deps; direct control | We own one extra tiny module | Low |
| `get-port` package (PRD pick) | Battle-tested | Adds a dep for tiny logic | Low |

**Recommendation: roll our own.** `findFreePort` is a 12-line loop; testing it requires a real socket either way. Skipping the dep keeps install-size minimal.

### Decision 3 — Process-on-port detection (`whoHoldsPort`)

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **`lsof -i :PORT -P -n` (macOS + Linux), fall back to `ss -lptn` on Linux** | Universal on macOS/Linux; minimal parsing | Output format is loosely structured, brittle to version changes | Medium |
| Pure Node (no shelling out) | No external dep | Not really possible — Node has no API to enumerate process holding a TCP port | — |
| Skip and just say "port busy" | Simple | Worse UX; PRD §8.2 explicitly shows the rich error | Low |

**Recommendation: `lsof` first, `ss` fallback, return `null` on failure.** Best-effort: if neither tool exists, the `peel run` UX still says "port is busy" — just without the friendly PID/command details. Tests that exercise `whoHoldsPort` skip on platforms where lsof is missing (gate with `which lsof`).

### Decision 4 — Branch listing format

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **`git for-each-ref --format=… refs/heads refs/remotes/origin`** | Single call; we get name + committerdate at once; sortable | Need to dedupe local-vs-remote ourselves | Low |
| `git branch -a` parse | Familiar | Pretty-print output, no dates without a second call | Low |
| `git ls-remote` (network) | Always fresh | Requires network; covered by `gitFetch` already | High |

**Recommendation: `for-each-ref`.** Clean, one shot, structured output, plays well with our committerdate-desc sort.

### Decision 5 — Test strategy

| Module | Strategy | Why |
|---|---|---|
| `config-load` | Real fs via `tmp-promise`; write fixture `.peel.yml` files; assert merged Config | Reading files is the whole point — mocks lose coverage |
| `git.ts` | Real git via `tmp-promise` + execa; helper that spins up a bare repo + a worktree with seeded commits and remote refs | PRD §11 explicit; no mocks |
| `worktree.ts` | Real git as above; assert filesystem changes after each operation | Same |
| `port.ts` | Real `net.Server` binding to assigned ports in a tmp range | The whole module is about real OS sockets |
| `whoHoldsPort` | Real Node server pinned to a port; spawn `lsof` and assert the returned PID matches | Skip whole describe block when `which lsof` fails (CI matrix has lsof on both linux and macOS images) |

A shared test helper (`test-utils/git-fixture.ts`) creates an isolated repo with two seeded branches + a remote (file:// URL pointing to a sibling bare repo). All git tests reuse it.

## Recommendation

Land the four primitives bottom-up under Strict TDD, in this order:

1. **`config-load`** (no subprocess deps, easiest) — RED tests for: file at cwd, file at git root parent, missing file (returns null), malformed YAML, version mismatch, schema-invalid → friendly errors. GREEN: a small `loadConfig(cwd) → Config | null`.
2. **`git.ts`** — extract `findGitRoot`, then `getRepoName` (origin URL parser → fallback to basename), `currentBranch`, `gitFetch`, `listBranches`. Each gets its own test suite with the shared fixture.
3. **`worktree.ts`** — `slugify`, `worktreePath`, `createWorktree`, `listWorktrees`, `removeWorktree`. Tests use the same fixture and assert filesystem state + `git worktree list --porcelain` output.
4. **`port.ts`** — `isPortBusy`, `findFreePort`, `whoHoldsPort`. Tests bind real Node servers; skip `whoHoldsPort` if `lsof` not available.
5. **Refactor**: `commands/init.ts` imports `findGitRoot` from `core/git.ts`. Existing init tests stay green.

After this lands, `peel run` is a thin orchestration layer over these four modules.

## Risks

1. **Slow integration tests** — real git + real net could push the integration project beyond a few seconds. Mitigation: keep the bare repo fixture cheap (one commit, two branches), reuse across tests via `beforeAll` per-suite.
2. **Network-dependent `gitFetch`** — tests must use `file://` remotes pointing at sibling bare repos so no network is touched. Helper to create both.
3. **`lsof` absence on minimal CI containers** — already mitigated: skip the describe block when `which lsof` fails. ubuntu-latest GH Actions image has lsof.
4. **Cross-platform path slugify** — branch names with backslashes, dots, spaces. Mitigation: replace `/` and any non-`[A-Za-z0-9_.-]` with `-`, then collapse runs of `-`.
5. **Worktree base directory not writable / outside repo** — already covered as PRD §9.11; primitive should validate the base dir is a real directory before attempting `git worktree add`.
6. **Port test parallelism** — vitest runs files in parallel by default. Each port test uses an ephemeral base (large random offset within an OS-assigned high range) to avoid cross-test collisions.

## Ready for Proposal

**Yes.** All five recommendations are firm. Translation to spec scenarios is straightforward — each primitive function maps to one Requirement with multiple Given/When/Then scenarios. The proposal will declare four new specs (`config-load`, `git-ops`, `worktree-ops`, `port-ops`) and one minor refactor to the existing `init-command` capability.

Tell the user: "Explore done — execa + roll-own-port + lsof/ss best-effort + real-git fixture. Four new spec capabilities, one tiny refactor of init-command. Moving to proposal."
