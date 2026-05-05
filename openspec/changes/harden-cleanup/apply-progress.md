# Apply Progress: harden-cleanup + fuzzy-picker

**Mode**: Strict TDD. **Status**: 14/14 tasks complete. Single batch.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| A.1 build | — | — | — | — | ✅ dist/index.js 56.55 KB | ➖ Build step | ➖ |
| A.2 SIGINT cleanup | `test/run-sigint.integration.test.ts` | Integration | N/A (new) | ✅ Written first (referencing dist binary) | ✅ Passed on first run — production code already correct | ✅ See A.4 | ➖ None needed |
| A.3 GREEN | same | — | — | ✅ No production change required | ✅ Test passes | ➖ Confirmation step | ➖ |
| A.4 --keep + SIGINT | same | Integration | ✅ A.2 baseline | ✅ Written | ✅ Passed | ✅ Two distinct branches: cleanup-on / cleanup-off | ✅ Clean |
| B.1 FakePrompter.autocomplete tests | `src/core/__fixtures__/fake-prompter.test.ts` | Unit | ✅ 5/5 baseline | ✅ 3 new tests written first (happy / mismatch / cancel) | ✅ 8/8 passed | ✅ 3 cases covering value, mismatch, cancel | ➖ |
| B.2 Prompter port extension | `src/ports/prompter.ts` | — | — | (covered by B.1 RED) | ✅ Type-checks; downstream tests pass | ➖ Type-only addition | ✅ Clean |
| B.3 FakePrompter impl | `src/core/__fixtures__/fake-prompter.ts` | — | — | (covered by B.1 RED) | ✅ B.1 tests pass | ➖ Single behavior | ✅ Clean |
| B.4 ClackPrompter adapter | `src/ui/clack-prompter.ts` | — | ✅ existing prompter tests stay green | ➖ TypeScript-only, no unit test (real clack autocomplete needs TTY) | ✅ Typecheck clean | ➖ Triangulation skipped: adapter mirrors existing select pattern; covered by build + integration smoke | ✅ Clean |
| B.5 update branch-picker tests | `src/core/branch-picker.test.ts` | Unit | ✅ 4/4 baseline | ✅ Tests fail after script swap (RED state confirmed: "expected 'autocomplete' to be 'select'") | ✅ After B.6 + transcript fix: 4/4 passed | ✅ happy + cancel + 2 explicit-branch tests | ✅ Clean |
| B.6 swap branch-picker impl | `src/core/branch-picker.ts` | — | ✅ B.5 RED → GREEN | ✅ B.5 tests pass; transcript reflects autocomplete | ✅ Mode picker still uses select (unchanged) | ➖ Single call-site swap | ✅ Clean — TODO comment removed |
| B.7 cross-flow verification | `src/core/run-flow.test.ts` | Unit | ✅ all run-flow tests | ✅ One test "cancel mid-picker" failed because it scripted a `select` for the branch picker | ✅ Updated to `autocomplete`; 13/13 run-flow tests pass | ✅ All run-flow scenarios stay green | ✅ Clean |
| C.1 README | `README.md` | — | — | — | ✅ Doc updated | ➖ Doc-only | ➖ |
| C.2 full gates | — | — | ✅ 220 baseline | — | ✅ lint OK (76 files), typecheck clean, build 56.94 KB, tests **225/225** | ➖ Gate step | ➖ |
| C.3 git status | — | — | — | — | ✅ No stray files | ➖ | ➖ |

## Test Summary

- **Total tests in suite**: 225 (5 new — 3 FakePrompter + 2 SIGINT integration)
- **Total tests passing**: 225/225
- **Layers used**: Unit (220), Integration (5)
- **Approval tests**: None — branch-picker swap is a behavior-preserving call-site change
- **Pure functions created**: None new (port extension is structural)

## Files Changed

| File | Action | What |
|---|---|---|
| `test/run-sigint.integration.test.ts` | Created | 2 SIGINT integration tests |
| `src/ports/prompter.ts` | Modified | + `AutocompleteOption<T>` type, + `autocomplete<T>()` method |
| `src/ui/clack-prompter.ts` | Modified | + `autocomplete` adapter delegating to `clack.autocomplete` |
| `src/core/__fixtures__/fake-prompter.ts` | Modified | + `autocomplete` script kind + handler |
| `src/core/__fixtures__/fake-prompter.test.ts` | Modified | + 3 tests for autocomplete |
| `src/core/branch-picker.ts` | Modified | `select` → `autocomplete`; placeholder; removed TODO |
| `src/core/branch-picker.test.ts` | Modified | Script kind: `select` → `autocomplete` |
| `src/core/run-flow.test.ts` | Modified | "cancel mid-picker" script kind: `select` → `autocomplete` |
| `README.md` | Modified | "type-to-filter branch picker" mention |

## Deviations from Design

None. Design predicted "no production code changes" for SIGINT path — confirmed by the integration test passing on first run. Branch-picker swap is exactly as designed.

## Issues Found

None. The SIGINT path (cleanup + trap + exit code) was correct from `peel-run-command`; the integration test simply locks it in.
