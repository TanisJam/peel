# Verification Report: peel-config

**Change**: peel-config
**Mode**: Strict TDD
**Capabilities**: 1 NEW (config-command)

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 21 |
| Tasks complete | 21 |
| Tasks incomplete | 0 |

All 8 phases marked `[x]`. Apply-progress confirms.

---

## Build & Tests Execution

| Gate | Result |
|---|---|
| `npm run lint` | ✅ 75 files, 0 errors |
| `npm run typecheck` | ✅ no errors |
| `npm run build` | ✅ `dist/index.js` 56.55 KB |
| `npm run test` | ✅ **220 / 220 passed** (216 unit + 4 integration), 0 skipped |

**Coverage**: ➖ Not measured (`@vitest/coverage-v8` deferred — same as prior changes).

---

## TDD Compliance (Strict TDD)

✅ COMPLIANT.

Apply-progress contains a complete TDD Cycle Evidence table — every behavior task pair shows RED (test written first) → GREEN → TRIANGULATE (≥ 2 cases) → REFACTOR. Skipped triangulation is justified for the 2 structural tasks (index.ts wiring; docs/gates) and the export-only refactor of `findConfigPath` (mechanical visibility change, no logic added).

---

## Test Layer Distribution

| Layer | Files (this change) | Tests (this change) | Notes |
|---|---|---|---|
| Unit | 4 (1 modified + 3 new) | 23 new (3 findConfigPath + 10 config-flow + 10 commands/config) | All use `tmp-promise` for fs, `FakeRunner` for spawn, env injected via deps — no production-code mocks |
| Integration | 1 new | 4 new | Spawns built `dist/index.js`; uses `process.execPath -e "process.exit(0)"` as fake editor |
| Total project | 35 files | 220 | All passing |

---

## Spec Compliance Matrix

### Requirement: Show Merged Config as YAML (2 scenarios)

| Scenario | Test | Result |
|---|---|---|
| Prints merged config when .peel.yml exists | `src/core/config-flow.test.ts > showConfig > returns YAML containing user-set values and defaults; round-trips through loadConfig` + `src/commands/config.test.ts > runConfigShow > returns exitCode:0 with merged YAML` + integration `peel config (integration) > show prints merged YAML containing the user-set port.base` | ✅ COMPLIANT |
| Missing config | `src/core/config-flow.test.ts > showConfig > throws ConfigFlowError(no-config) when .peel.yml is missing` + `src/commands/config.test.ts > runConfigShow > returns exitCode:1 with peel-init hint when missing` | ✅ COMPLIANT |

### Requirement: Print Config Path (3 scenarios)

| Scenario | Test | Result |
|---|---|---|
| Path of existing config | `src/core/config-flow.test.ts > configPath > reports the absolute path and exists:true` + `src/commands/config.test.ts > runConfigPath > returns exitCode:0 + absolute path when present` + integration `path prints the absolute config path with exit 0 when present` | ✅ COMPLIANT |
| Would-be path when missing | `src/core/config-flow.test.ts > configPath > reports the would-be path and exists:false when missing inside a git repo` + `src/commands/config.test.ts > runConfigPath > returns exitCode:1 + would-be path when missing inside a repo` | ✅ COMPLIANT |
| Outside a git repo | `src/core/config-flow.test.ts > configPath > throws ConfigFlowError(no-git) when not inside any git repo` + `src/commands/config.test.ts > runConfigPath > returns exitCode:1 with a friendly error outside a git repo` | ✅ COMPLIANT |

### Requirement: Edit Config in $EDITOR (5 scenarios)

| Scenario | Test | Result |
|---|---|---|
| Spawns editor and propagates exit 0 | `src/core/config-flow.test.ts > editConfig > spawns the editor with the absolute config path and propagates exit 0` + integration `edit propagates the editor's exit code (fake editor exits 0)` | ✅ COMPLIANT |
| Propagates non-zero editor exit | `src/core/config-flow.test.ts > editConfig > propagates non-zero editor exit code` | ✅ COMPLIANT |
| Prefers $VISUAL over $EDITOR | `src/core/config-flow.test.ts > editConfig > prefers $VISUAL over $EDITOR when both set` | ✅ COMPLIANT |
| No editor configured | `src/core/config-flow.test.ts > editConfig > throws ConfigFlowError(no-editor) when neither VISUAL nor EDITOR is set` + `src/commands/config.test.ts > runConfigEdit > returns exit:1 with no-editor message when neither VISUAL nor EDITOR set` + integration `edit fails with EDITOR hint when neither VISUAL nor EDITOR is set` | ✅ COMPLIANT |
| Missing config | `src/core/config-flow.test.ts > editConfig > throws ConfigFlowError(no-config) when .peel.yml is missing; does not spawn` + `src/commands/config.test.ts > runConfigEdit > returns exit:1 with peel-init hint when .peel.yml is missing` | ✅ COMPLIANT |

**Compliance summary**: **10 / 10** scenarios COMPLIANT. 0 PARTIAL, 0 UNTESTED.

---

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Print MERGED config for `show`, not raw file | ✅ | `showConfig` reads `Config` and `yamlStringify`s it |
| `path` always prints, exit code = presence | ✅ | `runConfigPath` switches exit 0/1 on `result.exists` |
| `$VISUAL` first, then `$EDITOR`, then fail | ✅ | `resolveEditor` honors order; explicit error if both unset |
| Reuse `yamlStringify` options from `config-write.ts` | ✅ | Same `lineWidth`, `indent`, `defaultStringType`, `defaultKeyType` constants |
| `editConfig` uses `runner.spawn` not new method | ✅ | Reuses existing `Runner` port; FakeRunner covers test path |
| File inventory matches design | ✅ | All 5 new + 3 modified files present |

No deviations.

---

## File Inventory vs Design

| File | Expected | Present | Status |
|---|---|---|---|
| `src/core/config-load.ts` | Modified | Yes (`findConfigPath` exported) | ✅ |
| `src/core/config-flow.ts` (+ test) | New | Yes | ✅ |
| `src/commands/config.ts` (+ test) | New | Yes | ✅ |
| `src/index.ts` | Modified | Yes (config + 3 children) | ✅ |
| `test/config.integration.test.ts` | New | Yes | ✅ |
| `README.md` | Modified | Yes (Configure section) | ✅ |

---

## Issues Found

**CRITICAL** (must fix before archive):
None.

**WARNING** (should fix):
None.

**SUGGESTION** (nice to have):
1. `peel config edit` could optionally re-validate the file after the editor exits and print a hint if the YAML is now invalid. Currently users discover errors at the next `peel run`. Cost: small; value: nice UX.
2. `peel config get <key>` and `peel config set <key> <value>` for scripting. Out of PRD scope; would require schema-aware path resolution.
3. Add `@vitest/coverage-v8` (carryover suggestion from prior changes — same boilerplate).
4. `runConfigEdit` swallows execa-level errors via `formatError`. Probably fine since the fake/real runner path is well-bounded; consider surfacing the inner error message verbatim if a user reports an issue.

---

## Verdict

✅ **PASS**

All gates green (lint, typecheck, build, 220/220 tests). 10/10 spec scenarios COMPLIANT. TDD evidence complete. No critical or warning issues. Ready to commit, push, open PR.
