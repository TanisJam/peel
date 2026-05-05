# Tasks: Bootstrap Toolchain

## Phase 1: Foundation

- [x] 1.1 Install devDeps in `package.json`: `typescript@^5.6`, `@types/node@^20`, `tsup@^8.3`, `vitest@^2.1`, `@biomejs/biome@^1.9`, `@changesets/cli@^2.27`. Run `npm install`.
- [x] 1.2 Append `dist/` and `coverage/` to `.gitignore`.
- [x] 1.3 Verify `npm ls --depth=0` shows all 6 devDeps with no errors.

## Phase 2: Config Files

- [x] 2.1 Create `tsconfig.json` per design (NodeNext + strict + `noEmit: true` + `verbatimModuleSyntax`).
- [x] 2.2 Create `tsup.config.ts` per design (ESM, target `node20`, `bundle: true`, `dts: false`, `sourcemap: true`).
- [x] 2.3 Create `vitest.config.ts` per design (two `projects`: `unit` from `src/**/*.test.ts`, `integration` from `test/**/*.integration.test.ts` with `testTimeout: 30_000`).
- [x] 2.4 Create `biome.json` per design (`recommended`, `useImportType: error`, `noConsoleLog: off`, double quotes, semicolons, trailing commas, ignore `dist coverage node_modules .changeset`).
- [x] 2.5 Run `npx changeset init` to scaffold `.changeset/`. Then overwrite `.changeset/config.json` per design (`access: "public"`, `baseBranch: "main"`).

## Phase 3: Source + package.json

- [x] 3.1 Create `src/index.ts` per design (shebang + 2 placeholder `console.log` lines).
- [x] 3.2 Delete `bin/peel.mjs` and the empty `bin/` directory.
- [x] 3.3 Update `package.json`: change `bin` to `{ "peel": "./dist/index.js" }`, `files` to `["dist"]`, add the full `scripts` block per design.

## Phase 4: First Build & Smoke Verification

- [x] 4.1 Run `npm run typecheck` — must pass clean.
- [x] 4.2 Run `npm run lint` — must pass clean (run `npm run lint:fix` once if formatting drift).
- [x] 4.3 Run `npm run build` — must produce `dist/index.js`.
- [x] 4.4 Confirm `dist/index.js` line 1 is `#!/usr/bin/env node` (shebang preserved). If missing, fall back to tsup `banner` option and rebuild.
- [x] 4.5 Run `node dist/index.js` and confirm placeholder text prints.
- [x] 4.6 Run `npm link && peel && npm unlink -g @tanisjam/peel` — confirm the `bin` entry works as the user will see it.

## Phase 5: Smoke Tests

- [x] 5.1 Create `src/version.ts` exporting a hardcoded `VERSION = "0.0.1"` constant; import it from `src/index.ts` to verify TS module wiring works in the bundle.
- [x] 5.2 Create `src/version.test.ts` — single unit test asserting `VERSION` is a non-empty string. Run `npm run test:unit` — must pass.
- [x] 5.3 Create `test/smoke.integration.test.ts` — spawn `node dist/index.js` via `node:child_process`, assert exit 0 and stdout contains "coming soon". Run `npm run test:integration` — must pass.
- [x] 5.4 Run `npm run test` — both projects must pass.

## Phase 6: CI

- [x] 6.1 Create `.github/workflows/ci.yml` per design (matrix: `[ubuntu-latest, macos-latest]` × `[20, 22]`; steps: checkout, setup-node w/ npm cache, `npm ci`, lint, typecheck, build, test).

## Phase 7: Docs & Wrap-up

- [x] 7.1 Append a `## Development` section to `README.md`: prerequisites (Node ≥ 20), install, dev/build/test/lint/typecheck commands, release flow (`npx changeset` → PR → merge → `npm run release`).
- [x] 7.2 Run `npm run prepublishOnly` end-to-end — must pass clean (final gate).
- [x] 7.3 Stage all changes, run `git status` for a final review (no stray files, no committed `node_modules` or `dist`).

## Post-merge (orchestrator, not in this change)

- Re-run `/sdd-init` so `strict_tdd` flips to `true` for the next change.
- Push branch + open PR; CI must go green before merge.
