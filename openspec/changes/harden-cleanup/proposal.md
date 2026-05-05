# Proposal: harden-cleanup + fuzzy-picker

## Intent

Two pre-release polish items bundled in one change. (1) Close the only PARTIAL spec scenario from `peel-run-command` ("Cleanup On Exit / Ctrl+C") with a real SIGINT integration test. (2) Lift the branch picker from `clack.select` to `clack.autocomplete` so users with many branches can type-ahead — directly addresses PRD §5 / US-1 ("fuzzy-busco la rama").

## Scope

### In Scope
- New `test/run-sigint.integration.test.ts` — spawns built `dist/index.js` with a sleeping fake-dev, sends SIGINT to the parent peel process, asserts (a) parent exits with 130, (b) worktree dir is removed.
- Add `Prompter.autocomplete<T>(opts) → Promise<T | Cancel>` to the port.
- `ClackPrompter.autocomplete` adapter delegating to clack's native `autocomplete` (already shipped in 0.x).
- `FakePrompter.autocomplete` step + tests.
- Switch `branch-picker.ts` from `select` to `autocomplete` (init-wizard's small fixed pickers stay on `select`).
- README: brief mention of fuzzy in the Run section.

### Out of Scope
- Any changes to `cleanup.ts` or `run-flow.ts` unless the SIGINT test reveals a real bug.
- Replacing other `select` call sites (init wizard pickers — small fixed lists).
- Custom fuzzy algorithm — clack's default substring filter is fine.
- Multi-select autocomplete.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None.

> Both items are quality-of-implementation upgrades. The existing spec scenarios for `run-command` ("Cleanup On Exit / Ctrl+C") and `branch-picker` ("Returns the picked branch via prompt", "Cancel returns null") already cover the contract. The SIGINT test lifts the existing scenario from PARTIAL → COMPLIANT; the autocomplete swap doesn't change the contract.

## Approach

Two phases under Strict TDD. Phase A: SIGINT integration test (RED → GREEN, expecting GREEN on first pass since the production code is already correct). Phase B: extend Prompter port + ClackPrompter + FakePrompter, then swap branch-picker call sites; existing branch-picker tests update from `select` script steps to `autocomplete` script steps.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `test/run-sigint.integration.test.ts` | New | SIGINT end-to-end |
| `src/ports/prompter.ts` | Modified | Add `autocomplete` method + `AutocompleteOptions` |
| `src/ui/clack-prompter.ts` | Modified | Add `autocomplete` adapter |
| `src/core/__fixtures__/fake-prompter.ts` (+ test) | Modified | Add `autocomplete` step type |
| `src/core/branch-picker.ts` | Modified | Replace `select` with `autocomplete` |
| `src/core/branch-picker.test.ts` | Modified | Update FakePrompter scripts |
| `README.md` | Modified | Mention fuzzy filtering in branch picker |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| SIGINT integration test flaky on CI | Med | Wait for explicit ready marker; 10s timeouts; assert child gone before checking worktree |
| Process group surprises macOS vs Linux | Low | PRD §3 supports only macOS+Linux; both posix |
| Cancel symbol mismatch on autocomplete | Low | Adapter test asserts `isCancel(result)` is true |
| Existing branch-picker tests break | High (intentional) | Update scripts: `select` → `autocomplete`; spec scenarios unchanged |

## Rollback Plan

Revert the merge commit. Both items are additive: removing the SIGINT test costs no behavior, reverting the picker swap restores `select`. No persisted state.

## Dependencies

None new. `@clack/prompts` already exposes `autocomplete` in the installed version.

## Success Criteria

- [ ] `test/run-sigint.integration.test.ts` passes locally and on the CI matrix (Ubuntu + macOS × Node 20 + 22).
- [ ] `peel run` without arguments shows the autocomplete picker; typing narrows the list.
- [ ] All existing tests stay green; total suite passes.
- [ ] Verify-report confirms `run-command:Cleanup On Exit / Ctrl+C` is now COMPLIANT (no PARTIAL remaining).
- [ ] Strict TDD evidence in apply-progress.
