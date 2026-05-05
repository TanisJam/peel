# Proposal: peel init

## Intent

Ship the first user-facing feature of the CLI. `peel init` runs an interactive wizard in any Node repo, auto-detects sensible defaults (package manager, dev/build/start scripts, `.env` files), prompts the user for the rest, and writes a minimal `.peel.yml` config. Without this command, no other peel feature has a config to read.

## Scope

### In Scope
- `peel init` command (interactive + `--yes` non-interactive modes).
- Config schema for `.peel.yml` (`zod`); single source of truth for types.
- Canonical defaults object that the writer diffs against.
- Auto-detection: package manager (lockfile precedence + Corepack `packageManager`), env files (`.env*` excluding `*.example`), scripts (dev/build/start) from target `package.json`.
- YAML writer that emits only non-default fields, atomic write.
- "Existing config" overwrite confirmation; `--yes` bypasses prompts.
- Friendly errors: not in a git repo, missing `package.json`, user cancels mid-wizard.
- `Prompter` port + `@clack/prompts` adapter so the wizard is unit-testable with a fake.
- Strict TDD throughout: every behavior task is RED → GREEN → REFACTOR.
- Unit tests for schema, defaults, detection, writer, wizard logic. One integration test that spawns the built binary against a tmp repo.

### Out of Scope
- `peel run`, `peel list`, `peel clean`, `peel config` subcommands — separate changes.
- Worktree management, port checking, process spawning — separate changes.
- Workspaces / monorepo detection (PRD §14).
- Reading config from anywhere except repo root.
- Migration of existing `.peel.yml` between schema versions (only one version exists).

## Capabilities

### New Capabilities
- `init-command`: Interactive and non-interactive setup of `.peel.yml`. Includes the config schema, canonical defaults, auto-detection of package manager / env files / scripts, the wizard prompt flow, and the minimal-diff YAML writer.

### Modified Capabilities
None.

## Approach

Bottom-up, ports-and-adapters per `sdd/peel-init/explore`:
1. zod schema → 2. defaults → 3. detection (real fs, no mocks) → 4. writer (diff + YAML) → 5. `Prompter` port + `FakePrompter` → 6. wizard (driven by Prompter) → 7. clack adapter → 8. command + commander dispatch → 9. integration test.

The wizard is the only place where prompts and orchestration meet, and it does so through the `Prompter` port. Tests cover the wizard with the fake; the real adapter is exercised only by the integration test.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/index.ts` | Modified | Add commander dispatcher, register `init` |
| `src/commands/init.ts` | New | Thin command handler |
| `src/core/config-schema.ts` | New | zod schema + types |
| `src/core/config-defaults.ts` | New | Canonical defaults |
| `src/core/config-write.ts` | New | Diff + YAML serialize + atomic write |
| `src/core/detect.ts` | New | PM / env / scripts detection |
| `src/core/init-wizard.ts` | New | Wizard logic (Prompter-driven) |
| `src/ports/prompter.ts` | New | `Prompter` interface |
| `src/ui/clack-prompter.ts` | New | clack adapter |
| `src/ui/banner.ts` | New | intro/outro/error formatting |
| `src/core/__fixtures__/fake-prompter.ts` | New | Test fake |
| `src/**/*.test.ts` | New | Unit tests per module |
| `test/init.integration.test.ts` | New | Spawn-binary integration test |
| `package.json` | Modified | Add `commander`, `@clack/prompts`, `zod`, `yaml` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| clack cancel symbol leaks past wizard | Med | `isCancel` guard after every prompt; `Prompter` types make it explicit |
| YAML output non-deterministic | Low | Use `yaml` Document API with fixed options; round-trip test |
| Detection fails on edge repos (multiple lockfiles, no scripts) | Med | Lockfile precedence; gracefully skip script defaults if missing |
| Partial `.peel.yml` on cancel | Low | Atomic write at the very end; never write before all answers in |

## Rollback Plan

Single-PR change. Revert the merge commit. No data migration; no published npm version is tied to this change (still `0.0.1` placeholder).

## Dependencies

Runtime: `commander`, `@clack/prompts`, `zod`, `yaml` (all installed in this PR).

## Success Criteria

- [ ] `peel init --yes` writes a valid `.peel.yml` in a fresh tmp repo with reasonable defaults.
- [ ] `peel init` interactive flow can be driven to completion via `FakePrompter` in unit tests.
- [ ] All unit tests show explicit RED → GREEN evidence in apply-progress.
- [ ] Integration test spawns the binary and asserts the written file parses against the schema.
- [ ] Existing-config overwrite path tested (refuse + confirm).
- [ ] CI green on Node 20 + 22, ubuntu + macos.
