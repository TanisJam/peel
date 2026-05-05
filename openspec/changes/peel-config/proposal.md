# Proposal: peel-config

## Intent

Implement PRD §6.5 — `peel config show`, `peel config path`, `peel config edit`. Closes the user-facing CLI surface so users can inspect, locate, and edit `.peel.yml` without leaving the tool.

## Scope

### In Scope
- `peel config show` — print merged config (defaults + user overrides) as YAML, exit 0.
- `peel config path` — print the absolute path of `.peel.yml` (or where it would be), exit 0 if present, 1 if missing.
- `peel config edit` — spawn `$VISUAL || $EDITOR` on `.peel.yml`, propagate the editor's exit code.
- Friendly errors: `show` and `edit` fail with a `peel init` hint when no `.peel.yml`; `edit` also fails when neither `$VISUAL` nor `$EDITOR` is set.
- README "Configure" section.

### Out of Scope
- `peel config set <key> <value>` — not in PRD.
- Editor-launching outside `.peel.yml` (no template scaffolding here — `peel init` already exists).
- Validating the file after the editor exits — out of scope; users re-run `peel run` or `peel config show` to surface errors.
- Watch mode for live config changes.

## Capabilities

### New Capabilities
- `config-command`: three subcommands — `show`, `path`, `edit`. Covers YAML rendering of the merged config, path resolution (file or would-be), and editor spawning with proper exit-code propagation.

### Modified Capabilities
None.

## Approach

Three thin functions in a single new `core/config-flow.ts`: `showConfig`, `configPath`, `editConfig`. The first two are sync-pure-ish (compose `loadConfig` + `findConfigPath` + `findGitRoot`). `editConfig` injects a `Runner` so `FakeRunner` covers the spawn path in unit tests. `commands/config.ts` wires real adapters; commander dispatches `peel config <sub>` to each. One small additive export from `config-load.ts` (`findConfigPath(cwd) → string | null`) so callers can resolve "where would `.peel.yml` live" without trying to load+parse first.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/core/config-load.ts` | Modified | Export `findConfigPath` (additive; no behavior change) |
| `src/core/config-flow.ts` (+ test) | New | Three functions: `showConfig`, `configPath`, `editConfig` |
| `src/commands/config.ts` (+ test) | New | Wiring + dispatch |
| `src/index.ts` | Modified | Register `config show|path|edit` |
| `test/config.integration.test.ts` | New | End-to-end via shared fixture |
| `README.md` | Modified | "Configure" section |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `$EDITOR` set to a malformed command | Low | Surface execa exit code; user sees the editor's own error |
| `path` semantics confusion (file present vs absent) | Low | Print path always; use exit code (0 vs 1) to distinguish |
| YAML output format drift | Low | Reuse `yaml` package's `stringify` with same options as `config-write` |

## Rollback Plan

Revert the merge commit. `findConfigPath` is additive so older callers are unaffected. No persisted state changes.

## Dependencies

None new. `yaml` and `execa` already in deps.

## Success Criteria

- [ ] `peel config show` prints valid YAML that round-trips through `loadConfig`.
- [ ] `peel config path` prints an absolute path; exit 0 when present, 1 when absent.
- [ ] `peel config edit` opens the configured editor on the right file and propagates its exit code.
- [ ] All gates green: lint, typecheck, build, full test suite, CI matrix.
- [ ] Strict TDD evidence in apply-progress.
