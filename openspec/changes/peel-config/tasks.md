# Tasks: peel config

> Strict TDD active. Real fs/git via `tmp-promise`. No mocks. `FakeRunner` is a fake (scripted), not a mock.

## Phase 1: findConfigPath export

- [x] 1.1 RED: extend `src/core/config-load.test.ts` (or new `findConfigPath` test block) — finds `.peel.yml` in cwd, in git root, returns null when absent.
- [x] 1.2 GREEN: rename existing private `findConfigPath` in `src/core/config-load.ts` to `export function findConfigPath`. Verify existing tests still pass.

## Phase 2: showConfig

- [x] 2.1 RED: `src/core/config-flow.test.ts` — `showConfig` returns YAML string containing user-set values (e.g. `port.base`) AND default values; output is parseable; `loadConfig` round-trips.
- [x] 2.2 GREEN: `src/core/config-flow.ts` — `showConfig({cwd, ops})` using `yamlStringify` with same options as `config-write`.
- [x] 2.3 RED: missing config → throws `ConfigFlowError(no-config)`.
- [x] 2.4 GREEN.

## Phase 3: configPath

- [x] 3.1 RED: present file → `{path: <abs>, exists: true}`; missing but inside git repo → `{path: <gitRoot>/.peel.yml, exists: false}`; outside git repo → throws `ConfigFlowError(no-git)`.
- [x] 3.2 GREEN: `configPath({cwd, ops})`.

## Phase 4: editConfig

- [x] 4.1 RED: happy path — `$EDITOR=foo` set, `.peel.yml` exists; `editConfig` calls `runner.spawn` with `command: "foo /abs/path/.peel.yml"` and propagates exit 0.
- [x] 4.2 GREEN: `editConfig({cwd, ops, runner, env})`.
- [x] 4.3 RED: propagates non-zero — `runner.spawn` returns exit 7 → result `{exitCode: 7}`.
- [x] 4.4 RED: prefers `$VISUAL` over `$EDITOR` when both set.
- [x] 4.5 RED: neither `$VISUAL` nor `$EDITOR` → throws `ConfigFlowError(no-editor)`; `runner.spawn` not called.
- [x] 4.6 RED: missing `.peel.yml` → throws `ConfigFlowError(no-config)`; `runner.spawn` not called.

## Phase 5: commands/config.ts

- [x] 5.1 RED: `src/commands/config.test.ts` — `runConfigShow({cwd})` returns `{exitCode:0, message:<yaml>}` for happy path; `runConfigPath({cwd})` returns `{exitCode:0, message:<abs>}` when present, exit 1 when missing; `runConfigEdit` propagates editor exit; missing-config maps to friendly error in stderr.
- [x] 5.2 GREEN: `src/commands/config.ts` — three handlers + `formatConfigFlowError`.

## Phase 6: index.ts wiring

- [x] 6.1 Register `peel config` parent with `show`, `path`, `edit` subcommands. Existing init/run/list/clean tests stay green.

## Phase 7: integration

- [x] 7.1 RED: `test/config.integration.test.ts` —
  - Write `.peel.yml` with `port.base: 4242`; `peel config show` exits 0 and stdout contains `4242`.
  - `peel config path` exits 0 and stdout contains `/.peel.yml`; with no file, exits 1.
  - `peel config edit` with `EDITOR="node -e 'process.exit(0)'"` exits 0; with no editor, exits 1 mentioning EDITOR.

## Phase 8: docs + gates

- [x] 8.1 README — add "Configure" section with the three subcommands.
- [x] 8.2 `npm run prepublishOnly` end-to-end green.
- [x] 8.3 Final `git status` review — no stray tmp/lock files.
