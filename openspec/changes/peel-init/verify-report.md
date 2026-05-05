# Verification Report: peel-init

**Change**: peel-init
**Mode**: Strict TDD
**Capability**: `init-command` (NEW)

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 35 |
| Tasks complete | 35 |
| Tasks incomplete | 0 |

All 7 phases marked complete in `tasks.md`. Apply-progress confirms.

---

## Build & Tests Execution

| Gate | Result |
|---|---|
| `npm run lint` | ✅ 28 files, 0 errors |
| `npm run typecheck` | ✅ no errors |
| `npm run build` | ✅ `dist/index.js` 14.21 KB, sourcemap 29.37 KB |
| `npm run test` | ✅ **57 / 57 passed** (54 unit + 3 integration), 0 skipped |

**Coverage**: ➖ Not measured (`@vitest/coverage-v8` deliberately deferred per testing-capabilities cache).

**Binary smoke**: `dist/index.js` line 1 is `#!/usr/bin/env node`, mode 0755. The `init` subcommand is registered and the default action still prints the placeholder banner (preserves the existing smoke integration test).

---

## TDD Compliance (Strict TDD)

**Verdict**: ✅ COMPLIANT.

Apply-progress contains a complete TDD Cycle Evidence table — every behavior task pair shows RED (test written first) → GREEN (passing impl) → TRIANGULATE (≥ 2 cases) → REFACTOR (or "none needed") with the test file path and counts. Skipped triangulation is explicitly justified for the trivial banner pass-through helper. No `disabled`/`skipped` tests in any test file. No implementation slipped in without a preceding failing test.

---

## Test Layer Distribution

| Layer | Files | Tests | Notes |
|---|---|---|---|
| Unit | 8 | 54 | Schema, defaults, detect, writer, FakePrompter, wizard, command (all real fs via `tmp-promise`) |
| Integration | 2 | 3 | Existing smoke test + 2 new for `peel init --yes` and "outside git" |
| E2E | 0 | 0 | Out of MVP scope per PRD |

---

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| PM Detection | Corepack overrides lockfiles | `src/core/detect.test.ts > detectPackageManager > respects Corepack ... over lockfiles` | ✅ COMPLIANT |
| PM Detection | pnpm wins over npm | `src/core/detect.test.ts > detectPackageManager > picks pnpm when both ...` | ✅ COMPLIANT |
| PM Detection | Defaults to npm | `src/core/detect.test.ts > detectPackageManager > defaults to npm ...` | ✅ COMPLIANT |
| Env File Detection | Includes loadable, excludes templates | `src/core/detect.test.ts > detectEnvFiles > includes loadable env files ...` | ✅ COMPLIANT |
| Script Detection | Reads scripts from package.json | `src/core/detect.test.ts > detectScripts > returns dev/build/start when present` | ✅ COMPLIANT |
| Interactive Wizard | Cancel does not write | `src/commands/init.test.ts > runInitCommand > does not write when wizard returns null` + `src/core/init-wizard.test.ts > runWizard > returns null when the user cancels mid-flow` | ✅ COMPLIANT |
| Non-Interactive Mode | --yes writes defaults silently | `src/commands/init.test.ts > runInitCommand > with --yes writes a valid .peel.yml ...` + `test/init.integration.test.ts > peel init (integration) > --yes writes a schema-valid .peel.yml ...` | ✅ COMPLIANT |
| Existing-Config Confirmation | Refuse overwrite preserves file | `src/commands/init.test.ts > runInitCommand > does not write when wizard returns null` + `src/core/init-wizard.test.ts > runWizard > asks for overwrite confirmation first when existingConfig is true` | ✅ COMPLIANT |
| Minimal Output | Identical inputs produce byte-identical output | `src/core/config-write.test.ts > writeConfig > produces byte-identical output for identical inputs` | ✅ COMPLIANT |
| Pre-flight Validation | Outside git, refuse to run | `src/commands/init.test.ts > runInitCommand > fails non-zero outside a git repo` + `test/init.integration.test.ts > peel init (integration) > exits non-zero outside a git repo with a friendly message` | ✅ COMPLIANT |
| Atomic Write | Crash mid-write preserves existing file | `src/core/config-write.test.ts > writeConfig > preserves the existing file if write is interrupted before rename` | ✅ COMPLIANT |

**Compliance summary**: **11 / 11** scenarios COMPLIANT (100%).

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|---|---|---|
| PM Detection (Corepack + lockfile precedence) | ✅ Implemented | `detectPackageManager` in `src/core/detect.ts` matches the design's precedence list |
| Env File Detection | ✅ Implemented | `detectEnvFiles` filters `.example`/`.sample` and sorts |
| Script Detection | ✅ Implemented | `detectScripts` returns `null` for missing or malformed `package.json` |
| Interactive Wizard | ✅ Implemented | `runWizard` drives prompts in spec order; `isCancel` after every prompt |
| Non-Interactive Mode | ✅ Implemented | `runInitCommand` skips wizard when `yes: true` |
| Existing-Config Confirmation | ✅ Implemented | Wizard's first prompt when `existingConfig: true` |
| Minimal Output | ✅ Implemented | `pickNonDefault` + `yaml.stringify` with stable options |
| Pre-flight Validation | ✅ Implemented | `findGitRoot` walks upward; throws `PeelInitError("not-in-git-repo")` |
| Atomic Write | ✅ Implemented | `writeFile(tmp)` + `rename(tmp, target)`; `unlink` on failure |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Ports & adapters wizard | ✅ Yes | `Prompter` interface, `ClackPrompter` adapter, `FakePrompter` test fake |
| zod schema as source of truth | ✅ Yes | `Config = z.infer<typeof ConfigSchema>` |
| `yaml` (eemeli) for serialization | ✅ Yes | Used `yaml.stringify` with stable opts |
| PM precedence: Corepack > pnpm > bun > yarn > npm | ✅ Yes | Implemented exactly per design |
| Schema version literal `1` | ✅ Yes | `SCHEMA_VERSION = 1`; rejects unknown major |
| Atomic temp + rename | ✅ Yes | Implemented |
| commander dispatch | ✅ Yes | `init` subcommand registered; default action preserved |
| Trailing-newline rule in writer | ✅ Yes | Single `\n` enforced explicitly |
| `PeelInitError` with kind enum | ✅ Yes | Added kinds `not-in-git-repo` and `write-failed` |
| `buildConfigFromDetected` location | ⚠️ Deviated | Exported from `init-wizard.ts` (not inside the wizard closure) so the `--yes` path can use it without driving prompts. Cleaner separation; behavior unchanged. |
| `runWizard` failure mode | ⚠️ Deviated | Returns `Config \| null` instead of throwing on cancel. Null is the documented "no-op exit 0" path; design implied throw. Matches Cancel scenario in spec exactly. |
| clack Option type | ⚠️ Deviated | Cast via `Parameters<typeof clack.select<T>>[0]["options"]` because of conditional generic + `exactOptionalPropertyTypes`. Type-only adjustment; no runtime change. |

All three deviations are documented in apply-progress and re-validated here as acceptable.

---

## File Inventory vs Design

| File | Expected | Present | Status |
|---|---|---|---|
| `src/index.ts` | Modified | Yes | ✅ commander registered |
| `src/commands/init.ts` (+ test) | New | Yes | ✅ |
| `src/core/config-schema.ts` (+ test) | New | Yes | ✅ |
| `src/core/config-defaults.ts` (+ test) | New | Yes | ✅ |
| `src/core/config-write.ts` (+ test) | New | Yes | ✅ |
| `src/core/detect.ts` (+ test) | New | Yes | ✅ |
| `src/core/init-wizard.ts` (+ test) | New | Yes | ✅ |
| `src/core/__fixtures__/fake-prompter.ts` (+ test) | New | Yes | ✅ |
| `src/ports/prompter.ts` | New | Yes | ✅ |
| `src/ui/clack-prompter.ts` | New | Yes | ✅ |
| `src/ui/banner.ts` | New | Yes (formatError only — `intro`/`outro` come from clack directly via the adapter) | ✅ Acceptable simplification |
| `test/init.integration.test.ts` | New | Yes | ✅ |
| `package.json` | Modified | Yes | ✅ deps added |
| `README.md` | Modified | Yes | ✅ Usage section added |

---

## Issues Found

**CRITICAL** (must fix before archive):
None.

**WARNING** (should fix):
None. The three documented deviations are improvements over the design, not regressions.

**SUGGESTION** (nice to have):
1. Add `@vitest/coverage-v8` in a future change so we can enforce a coverage threshold on changed files (Strict TDD verify can then surface uncovered lines).
2. The wizard prints `intro`/`outro` only when `--yes` is false. Consider also printing a short summary banner after `--yes` writes (currently silent). Not in spec.
3. `PeelInitError` only uses `not-in-git-repo` and `write-failed` today — keep adding kinds as more failure modes appear in subsequent commands.

---

## Verdict

✅ **PASS**

All gates green (lint, typecheck, build, 57/57 tests). 11/11 spec scenarios compliant via passing tests. TDD cycle evidence complete in apply-progress. Three minor deviations from design, all justified and behavior-equivalent or improvements. Ready to commit, push, and open PR.
