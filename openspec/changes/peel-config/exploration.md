# Exploration: peel-config

> Implements PRD §6.5 — `peel config show`, `peel config path`, `peel config edit`. Three small subcommands sharing a single discovery primitive.

## Current State

- `src/core/config-load.ts` exposes `loadConfig(cwd) → Config | null` and the typed error `PeelConfigError`. It walks from `cwd` up to the git root looking for `.peel.yml` and parses+merges+validates. **The discovered file path is computed internally (`findConfigPath`) but is NOT exported** — that helper is private. The merged `Config` object is returned but the path is lost on success.
- `src/core/config-write.ts` writes the minimal `.peel.yml` deterministically using `yamlStringify` from the `yaml` package. The same library can serialize the merged config back out for `show`.
- `src/core/git.ts` exports `findGitRoot(cwd)` — needed for `peel config path` since the path must be reported even when `.peel.yml` does not exist (we still need the git root to compute where it WOULD be).
- `src/ports/runner.ts` exposes `Runner` with `run` (capture output) and `spawn` (stdio inherited). `peel config edit` needs `spawn` because `$EDITOR` is interactive (vim/nano take over the terminal).
- `src/index.ts` already wires `init`, `run`, `list`, `clean`. Commander `command(name).command(sub)` supports nested subcommands which is exactly what `peel config <sub>` requires.

## Affected Areas

- `src/core/config-load.ts` — needs a small additive: export `findConfigPath` (or a thin `getConfigPath(cwd)`) so callers can know WHERE the config lives or would live.
- `src/core/config-show.ts` (NEW or maybe inline) — formats the merged config back to YAML deterministically.
- `src/core/config-flow.ts` (NEW) — three thin functions: `showConfig`, `configPath`, `editConfig` (last one composes `Runner.spawn`).
- `src/commands/config.ts` (NEW) — wires real adapters; commander dispatches to the three subcommands.
- `src/index.ts` — register `config` as a parent subcommand with `show`/`path`/`edit` children.
- `src/ui/banner.ts` — lightweight, may add a `formatConfigError` if the error formatting differs from existing init/run errors. Most likely reuse `formatError` + `peel init` hint.
- `test/config.integration.test.ts` (NEW) — end-to-end via built binary.
- `README.md` — "Configure" section.

## Subcommand semantics (from PRD §6.5)

| Subcommand | Output | If `.peel.yml` missing |
|---|---|---|
| `peel config show` | merged config as YAML to stdout, exit 0 | error to stderr + `peel init` hint, exit 1 |
| `peel config path` | absolute path to `.peel.yml` to stdout, exit 0 | print where it WOULD be created (`<gitRoot>/.peel.yml`), exit 0 — useful for scripting `peel config path > /dev/null && cat $(peel config path)`. Or: error like the others. Per PRD: "imprime ruta absoluta del archivo de config" — implies it should print the path even if the file doesn't exist. **Decision**: print the path it would use, exit 0 if the file exists, exit 1 with the same path printed when it doesn't. This way scripting works (`PEEL_CFG=$(peel config path)`) and CI surfaces the missing-config case via exit code. |
| `peel config edit` | spawns `$EDITOR <path>` with stdio inherited; exit code = editor's | error to stderr if no `.peel.yml` AND `$EDITOR` unset; bonus: if no `.peel.yml` but `$EDITOR` set, hint at `peel init`. Decision: refuse to spawn when missing-config (you should not start a new file in `$EDITOR` because the schema is non-trivial; `peel init` is the right path). |

### Config "show" output details

PRD says "imprime el config actual en YAML". Options:
1. **Print the merged Config object** (defaults filled in) — most useful for users who want to know what peel will actually do. Loses the user's authored layout.
2. **Print the raw `.peel.yml` file content** — preserves the user's layout/comments. Less useful when the file is minimal.

Per PRD wording, the merged view is the more accurate "current config". **Recommendation**: print the merged YAML. If users want raw, they have `peel config path | xargs cat`.

### `$EDITOR` resolution chain

Standard: `$VISUAL`, then `$EDITOR`, then a sensible fallback (`vi`). Friendlier: surface a clear error if none set rather than silently invoking `vi` on machines without one. **Recommendation**: try VISUAL → EDITOR → fail with friendly error pointing at how to set `$EDITOR`.

### Reusing the Runner port

`Runner.spawn` returns `SpawnHandle` with `exited: Promise<{exitCode, signal}>`. Perfect for an editor: spawn, await exit, propagate code. No change to the port needed.

## Approaches

1. **Three thin function in one `config-flow.ts` + commands wrapper** *(recommended)* — `showConfig({cwd, ops})`, `configPath({cwd, ops})`, `editConfig({cwd, ops, runner})`. Pure-ish: `show` and `path` are sync (they only need `loadConfig` + `findGitRoot`). `edit` is async (spawn await). Tests use `FakeRunner` for edit.
   - Pros: matches the layered pattern; trivially TDD-able; tiny surface.
   - Cons: extra file (~50 lines).
   - Effort: Low.

2. **Single `config-flow.ts` with a discriminated union arg** — `configFlow({cwd, mode: "show"|"path"|"edit", ops, runner})`.
   - Pros: one entry point.
   - Cons: harder to test (unions); modes have different return types (`{yaml}` vs `{path}` vs `{exitCode}`); needs casting.
   - Effort: Low.

3. **Inline in `commands/config.ts`** — skip the flow layer.
   - Pros: fewer files.
   - Cons: violates the pattern (`runFlow`, `listFlow`, `cleanFlow` all live in `core/`); harder to TDD without spawning real `$EDITOR`.
   - Effort: Low.

## Recommendation

**Approach 1.** Match the established pattern. The `editConfig` function takes a `Runner` injection so a `FakeRunner` covers the spawn path in unit tests. `showConfig` and `configPath` are pure read-only; one new export from `config-load.ts` (`findConfigPath`) closes the gap.

## Capability Plan

One new capability:
- `config-command` — covers all three subcommands (show / path / edit) as one cohesive surface. Each subcommand's behavior is a separate requirement with its own scenarios.

No spec modifications. The existing `config-load` capability stays unchanged in semantics; the public surface gains `findConfigPath` but that's an additive non-behavioral export — no spec change required there either.

## Risks

- **`$EDITOR` set to a malformed command** — execa with `shell:true` will pass through; an unknown editor exits non-zero, we propagate the code. Acceptable.
- **YAML output drift between authoring style and merged style** — solved by always printing merged YAML for `show`. Users wanting their authored file have `path`.
- **Editor spawning in CI** — bulk runs of `peel config edit` without `$EDITOR` set should fail fast with a friendly error. Same path for missing `.peel.yml`.
- **`path` subcommand semantics under no-config** — Decision documented above (print would-be path, exit 1). User-friendly for scripts.

## Ready for Proposal

Yes. One new capability (`config-command`) with three requirements (show / path / edit). Five new files (`config-flow.ts` + test, `commands/config.ts` + test, integration test) + a single additive export in `config-load.ts` + commander wiring + README. Strict TDD throughout, with `FakeRunner` for the editor spawn path.
