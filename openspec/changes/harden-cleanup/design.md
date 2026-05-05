# Design: harden-cleanup + fuzzy-picker

## Technical Approach

Two phases under Strict TDD. **Phase A** — write a real-process integration test that drives `peel run` to readiness, sends SIGINT to the parent, and asserts cleanup happened. No production code changes expected. **Phase B** — add `autocomplete` to the `Prompter` port + `ClackPrompter` + `FakePrompter`, then swap `branch-picker.ts` from `select` to `autocomplete`. Existing branch-picker tests update their script entries from `select` to `autocomplete`.

## Architecture Decisions

### Decision: SIGINT test uses streaming `child_process.spawn`, not `spawnSync`

**Choice**: `node:child_process.spawn` with `{stdio: ['ignore','pipe','pipe']}`; listen for a known stdout marker before signaling.
**Alternatives**: `spawnSync` with a fixed delay before signaling.
**Rationale**: A fixed delay is racey on slow CI runners. Waiting for an explicit "ready" line is deterministic. The fake-dev script prints `PEEL_TEST_READY` on its first tick, then loops forever.

### Decision: Use SIGINT (not SIGTERM) and assert exit code 130

**Choice**: `child.kill("SIGINT")` from the test; assert parent exit `code === 130` OR `signal === "SIGINT"`.
**Alternatives**: SIGTERM (143).
**Rationale**: SIGINT is what Ctrl+C produces and is the scenario we want to lock in. Some runtimes report `signal` instead of `code`; accept either via `||`.

### Decision: Verify by polling the worktree path *after* the parent exits

**Choice**: After `child.on("exit", ...)`, check `existsSync(worktreePath) === false`.
**Alternatives**: poll during the SIGINT delivery window.
**Rationale**: Cleanup is async and runs to completion before the trap calls `process.exit()`. Once the parent has actually exited, we know cleanup either succeeded or failed — no race.

### Decision: Add `autocomplete` to the port instead of overloading `select`

**Choice**: New method `prompter.autocomplete<T>(opts)`. Keep `select` as-is.
**Alternatives**: Add a `filter`/`searchable` flag to `select`.
**Rationale**: Clack ships these as separate prompt types with different UIs (`select` shows full list, `autocomplete` shows a filtered live list under a typed input). Conflating them in the port leaks the UI choice into call sites that shouldn't care. Two methods = clearer.

### Decision: Only `branch-picker` switches to autocomplete; init-wizard stays on `select`

**Choice**: `init-wizard` keeps `select` for `packageManager`, `mode`, `port.strategy`, etc.
**Rationale**: Those are 2-4 fixed options; type-ahead is overhead. Autocomplete only earns its keep when the option list is variable-length (branches in real repos).

## Data Flow

```
SIGINT path (already correct in code; the test locks it in):

  test ── spawn ──→ peel parent ── execa(spawn,stdio:inherit) ──→ fake-dev (loops)
   │                    │                                              │
   │                    │  installCleanupTrap registered               │
   │                    │                                              │
   ╰── kill SIGINT ─→  process.on("SIGINT") ── handle.kill("SIGINT") ─→╯
                            │                            │
                            ╰── await cleanup() ─────────╯
                            │
                            ╰── process.exit(130)
                            │
   test waits for "exit" event ──→ assert worktree gone
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `test/run-sigint.integration.test.ts` | Create | SIGINT end-to-end test |
| `src/ports/prompter.ts` | Modify | Add `autocomplete` method + `AutocompleteOption<T>` type |
| `src/ui/clack-prompter.ts` | Modify | Add `autocomplete` adapter calling `clack.autocomplete` |
| `src/core/__fixtures__/fake-prompter.ts` | Modify | Add `autocomplete` step kind + handler |
| `src/core/__fixtures__/fake-prompter.test.ts` | Modify | Add tests for new step |
| `src/core/branch-picker.ts` | Modify | Replace `select` call with `autocomplete`; keep cancel + return contract |
| `src/core/branch-picker.test.ts` | Modify | Update FakePrompter scripts (`select` → `autocomplete`) |
| `README.md` | Modify | One-line mention of fuzzy in the Run section |

## Interfaces / Contracts

```ts
// prompter.ts (additive)
export type AutocompleteOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

export interface Prompter {
  // ... existing methods ...
  autocomplete<T extends string>(opts: {
    message: string;
    options: AutocompleteOption<T>[];
    initialValue?: T;
    placeholder?: string;
  }): Promise<T | Cancel>;
}

// branch-picker.ts (call-site change)
const choice = await args.prompter.autocomplete({
  message: "Pick a branch (type to filter)",
  placeholder: "Type to filter…",
  options: args.branches.map((b) => ({
    value: b.name,
    label: b.isRemote ? `${b.name} (origin)` : b.name,
  })),
});
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Integration | SIGINT triggers cleanup + exit 130 | `child_process.spawn` with stdout pipe; wait for `PEEL_TEST_READY` marker emitted by fake-dev; send `kill("SIGINT")`; await `exit` event; assert worktree path no longer exists |
| Unit | `FakePrompter.autocomplete` script behavior | New `.test.ts` cases mirror `select` cases (returns scripted value, throws on script exhaust, mismatched-kind error) |
| Unit | `branch-picker` happy path + cancel | Update existing tests to use the new step type; spec scenarios unchanged |
| Manual / smoke | Real `peel run` shows the autocomplete UI | Optional — clack autocomplete needs a TTY; covered by build + existing run integration test that bypasses the picker via positional arg |

## Migration / Rollout

No migration required. New test file, additive port method, swap call site. CI matrix runs the SIGINT test on Ubuntu and macOS (both Node 20 + 22).

## Open Questions

None.
