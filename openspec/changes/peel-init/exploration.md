# Exploration: peel-init

> Implement `peel init`, the interactive wizard that auto-detects project conventions and writes a minimal `.peel.yml`.

## Current State

`src/index.ts` only prints a placeholder banner. There is no command parsing, no I/O layer, no config schema. `commander` is not yet a dependency. The toolchain (TS + tsup + vitest workspace + Biome + Changesets + CI) is in place; **Strict TDD is now active**.

Reference: `peel-cli-prd.md` §6.1 (init flow), §7 (config schema), §8 (UX), §9 (edge cases).

## Affected Areas

- `src/index.ts` — gain a CLI dispatcher (commander) and wire `init` as a subcommand.
- `src/commands/init.ts` — new. Thin command handler that wires the real prompter + wizard + writer.
- `src/core/config-schema.ts` — new. zod schema for `.peel.yml`, single source of truth for types.
- `src/core/config-defaults.ts` — new. Canonical defaults; the writer diffs answers against this.
- `src/core/config-write.ts` — new. `diffAgainstDefaults` + YAML serialize + atomic file write.
- `src/core/detect.ts` — new. `detectPackageManager`, `detectEnvFiles`, `detectScripts`.
- `src/core/init-wizard.ts` — new. Takes a `Prompter` port, runs the question flow, returns a parsed config.
- `src/ports/prompter.ts` — new. Interface (`Prompter`) so the wizard is testable without driving a real terminal.
- `src/ui/clack-prompter.ts` — new. Thin adapter over `@clack/prompts` implementing `Prompter`.
- `src/ui/banner.ts` — new (small). `intro`, `outro`, error formatter.
- `package.json` — add deps: `commander`, `@clack/prompts`, `zod`, `yaml`. (No `picocolors` yet — clack handles output.)
- Tests under `src/core/*.test.ts` (unit) and `test/init.integration.test.ts` (real fs, real binary spawn).

## Approaches

### Decision 1 — Wizard testability strategy

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **Ports & adapters (`Prompter` interface)** | Wizard is pure-ish; tests plug a `FakePrompter` with scripted answers; covers branching cleanly | Two extra files (port + adapter) | Low |
| Mock `@clack/prompts` in tests | Less code | Brittle; couples tests to a third-party API; worse error messages | Low |
| Test only via integration (spawn binary, pipe stdin) | "Most realistic" | Slow, flaky on CI, terrible feedback loop, hard to assert branches | High |

**Recommendation: Ports & adapters.** Indispensable under Strict TDD — the wizard logic (question order, default propagation, validation) needs to be unit-testable in milliseconds. The adapter is a few lines of pass-through.

### Decision 2 — Config schema library

`zod` per PRD. Provides a Zod-to-TS type via `z.infer<typeof Schema>`, runtime validation with readable errors, and tree-shakes well. `valibot` is smaller but the ecosystem benefit of `zod` outweighs ~30 KB.

### Decision 3 — YAML library

`yaml` (eemeli) over `js-yaml`. Key reasons: (1) deterministic output with explicit `Document` API for stable formatting (matters for PRD's "minimal file" goal), (2) round-trip safe, (3) PRD explicitly recommends.

### Decision 4 — Package manager detection

Detect by lockfile presence in this order (first match wins): `pnpm-lock.yaml` → `bun.lock`/`bun.lockb` → `yarn.lock` → `package-lock.json` → default `npm`. Also honor `package.json#packageManager` (Corepack) if present — that field overrides lockfile sniff.

### Decision 5 — Env-file detection

Glob `.env*` in the repo root, exclude `*.example` and `*.sample`. Order alphabetically. The wizard offers multi-select with all detected pre-checked. Files in `.gitignore` are still listed (the user may legitimately want to copy them — that is the whole point).

### Decision 6 — "Minimal" config writing

PRD §7: write only fields that differ from defaults. Implementation: a small recursive `pickNonDefault(value, defaults)` that returns `undefined` for equal-to-default, then strips `undefined` properties before serializing. Schema-aware version (zod-driven) is overkill — plain deep-equal-to-default check works.

### Decision 7 — Existing config handling

If `.peel.yml` exists: confirm overwrite. With `--yes` flag: silent overwrite. With user "no": exit 0 (not 1) with a friendly note.

## Recommendation

Build it bottom-up so each layer ships with tests in green before the next one is touched:

1. **Schema** (`config-schema.ts` + tests) — RED test asserting valid input parses, GREEN add zod schema.
2. **Defaults** (`config-defaults.ts` + tests) — assert the defaults object itself parses against the schema.
3. **Detection** (`detect.ts` + tests) — pure functions, tmp-promise dirs (no mocks; real fs per PRD §11).
4. **Writer** (`config-write.ts` + tests) — diff against defaults + YAML round-trip + write to tmp file.
5. **Prompter port + Fake** (`ports/prompter.ts` + `core/__fixtures__/fake-prompter.ts`).
6. **Wizard** (`init-wizard.ts` + tests) — drives the FakePrompter through happy path, cancel path, "config exists" branch.
7. **clack adapter** (`ui/clack-prompter.ts`) — tiny, no unit tests; covered by integration.
8. **Command + CLI dispatch** (`commands/init.ts`, `index.ts`) — wire commander, register `init`.
9. **Integration test** (`test/init.integration.test.ts`) — spawn `node dist/index.js init --yes` in a tmp repo (with a fake `package.json` and lockfile), assert `.peel.yml` is written and parses.

## Risks

1. **`@clack/prompts` cancel handling** — returns a special `Symbol("cancel")`. Wizard must check `isCancel()` after every prompt and exit cleanly. Captured as a Prompter-level concern.
2. **Stable YAML output** — must be deterministic so two runs over the same answers produce identical files. The `yaml` package's `Document` API gives us control; pin formatting (no flow style for collections, 2-space indent, single trailing newline).
3. **"Detect" determinism** — multiple lockfiles in the same repo. Pick by precedence; do NOT fail. Document the order in the PRD-aligned comment.
4. **Path handling cross-platform** — Windows is out of MVP scope, but path separators in tests must use `node:path`.
5. **Cancel in the middle of the wizard** — should NOT leave a partial `.peel.yml`. Write only at the very end, atomically (`writeFile` + rename), and never before all prompts return.
6. **No `package.json` / no git** — fail early in the command handler with a clear message; do not crash inside the wizard.

## Ready for Proposal

**Yes.** Architecture and library picks are clear, the bottom-up TDD order is ready to translate into spec scenarios + design + tasks. Tell the user: "Explore done — ports & adapters wizard, zod + yaml, detection by lockfile precedence, atomic write at the end. Moving to proposal."
