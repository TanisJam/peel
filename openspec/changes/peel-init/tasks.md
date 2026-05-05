# Tasks: peel init

> Strict TDD active. Behavior tasks use RED → GREEN → REFACTOR. Detection / writer / wizard tests use **real fs via `tmp-promise`** per PRD §11; never mock fs.

## Phase 1: Foundation

- [x] 1.1 Install runtime deps: `commander`, `@clack/prompts`, `zod`, `yaml`. Install dev dep: `tmp-promise`.
- [x] 1.2 Verify `npm ls --depth=0` shows all 5 new packages with no errors.

## Phase 2: Config Schema + Defaults

- [x] 2.1 RED: `src/core/config-schema.test.ts` — assert valid sample parses; assert wrong types throw `ZodError`; assert missing `version` is rejected. Run `npm run test:unit` — must fail.
- [x] 2.2 GREEN: `src/core/config-schema.ts` — zod schema per design (port, envFiles, packageManager, commands, preRun, worktree, git, `version: 1`). Export `Config = z.infer<...>` and `SCHEMA_VERSION`. Tests pass.
- [x] 2.3 RED: `src/core/config-defaults.test.ts` — `DEFAULT_CONFIG` parses against schema; `version === SCHEMA_VERSION`. Fails.
- [x] 2.4 GREEN: `src/core/config-defaults.ts` — export `DEFAULT_CONFIG: Config`. Tests pass.

## Phase 3: Detection

- [x] 3.1 RED: `src/core/detect.test.ts` — write tests for `detectPackageManager` covering: Corepack override (Scenario 1), pnpm vs npm collision (Scenario 2), defaults to npm (Scenario 3). Use `tmp-promise` to materialize each fixture.
- [x] 3.2 GREEN: `detectPackageManager(cwd)` in `src/core/detect.ts`. Tests pass.
- [x] 3.3 RED: tests for `detectEnvFiles` — includes `.env`, `.env.local`; excludes `.env.example`, `.env.production.sample` (REQ Env File Detection scenario).
- [x] 3.4 GREEN: `detectEnvFiles(cwd)`. Tests pass.
- [x] 3.5 RED: tests for `detectScripts` — reads `scripts.dev/build/start`; missing → `null`; missing/broken `package.json` → `{dev:null,build:null,start:null}` without throwing.
- [x] 3.6 GREEN: `detectScripts(cwd)`. Tests pass.
- [x] 3.7 REFACTOR: extract a `readPackageJson(cwd)` helper if 3.2/3.6 duplicate code. Tests stay green.

## Phase 4: Writer

- [x] 4.1 RED: `src/core/config-write.test.ts` — `pickNonDefault(answer, DEFAULT_CONFIG)` strips equal-to-default fields; deeply nested differences are kept. Fails.
- [x] 4.2 GREEN: implement `pickNonDefault`. Tests pass.
- [x] 4.3 RED: deterministic-output test — same answers serialized twice produce byte-identical output (REQ Minimal Output scenario). Single trailing `\n`.
- [x] 4.4 GREEN: `writeConfig(target, path)` using `yaml.stringify` + atomic temp+rename. Tests pass.
- [x] 4.5 RED: atomic-write test — pre-write `.peel.yml` with content `X`, simulate write that fails after temp file exists, assert `.peel.yml` still equals `X`.
- [x] 4.6 GREEN: ensure rename (not copy) and that no partial write touches the target. Tests pass.

## Phase 5: Prompter Port + Fake

- [x] 5.1 `src/ports/prompter.ts` — `Prompter` interface, `CANCEL` symbol, `isCancel`. No tests (type-only contract).
- [x] 5.2 `src/core/__fixtures__/fake-prompter.ts` — `FakePrompter` with `script(answers[])` that returns next answer per call; throws if script exhausted. One sanity unit test.

## Phase 6: Wizard

- [x] 6.1 RED: `src/core/init-wizard.test.ts` — happy path (REQ Interactive Wizard): script all 12 answers, assert returned `Config` parses against schema and reflects scripted values.
- [x] 6.2 GREEN: `runWizard({prompter, detected, cwd})` — drives prompts in order, applies detected defaults, returns `Config`.
- [x] 6.3 RED: cancel-path test — script a `CANCEL` at the third prompt; assert wizard returns `null` (or rejects with `WizardCancelled`); no fs calls were made.
- [x] 6.4 GREEN: handle cancel at every prompt; never write.
- [x] 6.5 RED: existing-config branch — when `.peel.yml` exists and confirm returns `false`, wizard returns "no-op"; when `--yes`, skipped entirely (REQ Existing-Config Confirmation, Non-Interactive Mode).
- [x] 6.6 GREEN: implement existing-config path; honor `--yes`.

## Phase 7: clack Adapter + Banner

- [x] 7.1 `src/ui/clack-prompter.ts` — adapter wrapping `@clack/prompts` to satisfy `Prompter`. Map clack's cancel symbol to `CANCEL`.
- [x] 7.2 `src/ui/banner.ts` — `intro`, `outro`, `formatError(err)`. No unit tests (covered by integration).

## Phase 8: Command + CLI Wiring

- [x] 8.1 `src/commands/init.ts` — orchestrates: pre-flight (git? package.json?) → detect → wizard → write. Maps errors to friendly messages.
- [x] 8.2 RED: pre-flight test — outside a git repo, command returns non-zero with a "not in a git repo" message. Use `tmp-promise` for the cwd.
- [x] 8.3 GREEN: wire pre-flight check (find `.git/` upward; if none, fail).
- [x] 8.4 `src/index.ts` — register `init` via commander; default action delegates to `run` later (currently fall back to placeholder banner if no subcommand).

## Phase 9: Integration Test

- [x] 9.1 RED: `test/init.integration.test.ts` — `tmp-promise` repo with `git init` + minimal `package.json` + `pnpm-lock.yaml`; spawn `node dist/index.js init --yes`; assert exit 0, `.peel.yml` written, parses against schema, `packageManager: pnpm`.
- [x] 9.2 GREEN: `npm run build && npm run test:integration` must pass.

## Phase 10: Docs + Gates

- [x] 10.1 README — add a brief "Usage" section with `npx @tanisjam/peel init` and a sample of the generated `.peel.yml`.
- [x] 10.2 Run `npm run prepublishOnly` end-to-end — must pass clean.
- [x] 10.3 `git status` final review — no `node_modules`, no `dist`, no temp `.peel.yml*` artifacts staged.
