# Exploration: harden-cleanup + fuzzy-picker

> Two pre-release polish items bundled in a single change. Closes the only PARTIAL spec scenario from `peel-run-command` (Cleanup On Exit / Ctrl+C) and lifts the branch picker from plain `select` to fuzzy autocomplete (PRD §5 / US-1).

## Current State

### SIGINT path

- `src/core/cleanup.ts > installCleanupTrap` registers `SIGINT`, `SIGTERM`, and `exit` handlers. On signal, it runs the handler, then `process.exit(128 + n)` (130 for SIGINT, 143 for SIGTERM). Returns an `unregister()`.
- `src/core/run-flow.ts` (lines 296-315) wires the trap as `async () => { handle.kill("SIGINT"); await cleanup(); }`. It then `await handle.exited` — when SIGINT fires, the trap kills the child first, awaits cleanup, exits the process.
- `src/ui/runner-execa.ts > spawn` uses `execa(..., { stdio: "inherit", reject: false })`. With inherited stdio in a TTY foreground group, Ctrl+C delivers SIGINT to **both** the parent and the child simultaneously — the child usually exits on its own. Our `handle.kill("SIGINT")` in the trap is a redundant safety net, not the only delivery path.
- The unit tests prove (a) the cleanup handler is idempotent, (b) `--keep` skips removal, (c) the trap registers/unregisters cleanly. **What is NOT proven**: end-to-end, send SIGINT to the parent peel process and observe the worktree dir actually disappears.

Reading the code, I think the path works correctly, but a real-process integration test would lock it in and catch any regression in the trap registration or the order-of-await in `runFlow`.

### Branch picker

- `src/core/branch-picker.ts > pickBranch` calls `prompter.select({...})` with all branches as options. For a repo with 30+ branches that's a long arrow-key scroll.
- Clack 0.x exports an `autocomplete` prompt with built-in type-ahead filtering and a `filter` callback. The Prompter port currently does NOT expose it.
- `FakePrompter` in `src/core/__fixtures__/fake-prompter.ts` covers `text`/`select`/`multiselect`/`confirm`. Needs an `autocomplete` step type.

## Affected Areas

### harden-cleanup
- `test/run-sigint.integration.test.ts` (NEW) — spawns built `dist/index.js` with a sleeping fake-dev (`node -e "setInterval(()=>{},1e3)"`); waits for stdout/stderr to show readiness; sends SIGINT to the parent; assertions on (a) parent exits with 130, (b) worktree dir gone, (c) child process gone.
- `src/core/cleanup.ts` and `src/core/run-flow.ts` — likely no change unless the integration test reveals a bug.

### fuzzy-picker
- `src/ports/prompter.ts` — add `autocomplete<T extends string>(opts) → Promise<T | Cancel>` method.
- `src/ui/clack-prompter.ts` — add `autocomplete` adapter delegating to clack's `autocomplete`.
- `src/core/__fixtures__/fake-prompter.ts` — add `autocomplete` step type.
- `src/core/__fixtures__/fake-prompter.test.ts` — add tests for the new step.
- `src/core/branch-picker.ts` — replace `prompter.select` with `prompter.autocomplete`. Add `placeholder` and a custom `filter` that matches case-insensitively against the branch name (so `feat-x` matches `feature/x`).
- `src/core/branch-picker.test.ts` — update the FakePrompter scripts (was `select`, now `autocomplete`).
- `src/core/init-wizard.ts` and other call sites — only switch `select` to `autocomplete` where the option list is variable-length and benefits from filtering. **For `init-wizard` (package manager picker, mode picker) the list is small and typed-confirmation isn't useful — keep `select`. Only switch branch-picker.**

## Approaches

### 1. Bundle (recommended)

Single PR with both:
- One integration test for SIGINT cleanup
- Prompter port extension + ClackPrompter + FakePrompter + branch-picker switch + tests
- README mention of fuzzy in the "Run" section

Pros: matches user request "vamos con el 1 y despues si algo... vamos con eso" + "sumale lo del fuzzy-picker tambien" — they explicitly asked for both in one bundle. Both items are "polish before release". Both are small. Both are independently safe.
Cons: slightly larger PR. Mitigated by clean phase split in tasks.md.
Effort: Low-Medium.

### 2. Two sequential changes

Pros: smaller PRs.
Cons: redundant — both ship together pre-release; user already grouped them.
Effort: Low + Low (slightly higher overall friction).

## Recommendation

**Approach 1.** Two phases: SIGINT integration first (no production code changes expected), fuzzy-picker second (port extension + adapter + branch-picker swap + test update).

## Spec impact

- `run-command` capability — the existing scenario "Cleanup On Exit / Ctrl+C" gets lifted from PARTIAL → COMPLIANT once the integration test proves it. **This is NOT a spec change**; it's a coverage upgrade. The spec language already requires the behavior; we just gain the test.
- `branch-picker` capability — switching the underlying prompt type (`select` → `autocomplete`) is also a quality-of-implementation change rather than a behavior change. The current spec scenarios ("Returns the picked branch via prompt", "Cancel returns null") stay true. **No spec modification**. We could optionally add an ADDED requirement for "filter narrows the visible set", but that's testable inside `FakePrompter` only with a real autocomplete UI flow which we don't have. I lean toward NOT adding a spec — the existing ones cover the contract.

So: **zero new capabilities, zero modified capabilities** from a spec-purist standpoint. The `proposal.md` will declare "None" under both buckets and the change is a hardening + UX polish.

## Risks

- **SIGINT integration test flakiness on CI** — sending a real signal to a real child process across macOS+Linux. Mitigations: (a) wait for an explicit "ready" stdout marker before signaling; (b) generous timeouts (10s); (c) post-signal, wait for the parent to actually exit before checking the worktree dir; (d) use `treeKillSignal: 'SIGINT'`-equivalent semantics so the child doesn't outlive the parent.
- **Process group surprises** — when `spawnSync`/`spawn`'s child has `detached: true`, signals don't traverse. We're using `child_process.spawn` (default `detached: false`) for the test parent, and execa `stdio: "inherit"` for the inner child — both inherit the test runner's foreground group. SIGINT to the parent reaches the child via the group. Acceptable; a posix-only test is fine since macOS+Linux are the only supported targets per PRD §3.
- **Clack autocomplete behavior in non-TTY tests** — clack's `autocomplete` requires interactive TTY, but our unit tests use `FakePrompter` so this doesn't apply. The integration test for `peel run` already passes a branch via `--yes` + positional, bypassing the picker entirely; we don't need to drive the autocomplete from spawnSync.
- **Cancel semantics drift** — `select` returns clack's cancel symbol; `autocomplete` should too. Verify in the adapter.

## Ready for Proposal

Yes. Single change, two clean phases, no spec modifications, zero new capabilities. Strict TDD throughout — the SIGINT integration test goes RED first (it doesn't exist), GREEN on first pass (no production change expected), and the fuzzy swap follows the standard RED → GREEN → TRIANGULATE pattern using the new FakePrompter step type.
