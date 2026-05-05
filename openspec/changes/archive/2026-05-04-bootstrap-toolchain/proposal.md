# Proposal: Bootstrap Toolchain

## Intent

The repo is a placeholder. Every subsequent change (commands, config, worktrees, port checks) needs a build, type-check, lint, and test harness in place first. This change installs that harness so Strict TDD can be enabled and real implementation work can begin.

## Scope

### In Scope
- TypeScript strict + NodeNext config (`tsconfig.json`)
- tsup build → single ESM bundle, target Node 20, shebang preserved (`tsup.config.ts`)
- Vitest with `projects: [unit, integration]`; integration uses real git via `tmp-promise` (`vitest.config.ts`)
- Biome for lint + format (`biome.json`)
- Changesets for releases (`.changeset/config.json`)
- GitHub Actions CI: lint + typecheck + test on Node 20 / 22, ubuntu + macos
- npm scripts: `dev`, `build`, `test`, `test:unit`, `test:integration`, `lint`, `lint:fix`, `format`, `typecheck`, `prepublishOnly`
- New entry `src/index.ts` with `#!/usr/bin/env node` shebang (replaces placeholder bin)
- `package.json` updated: devDeps, scripts, `bin` → `dist/index.js`, `files: ["dist"]`

### Out of Scope
- Real CLI commands (`init`, `run`, `list`, `clean`, `config`) — separate changes
- Husky / lint-staged pre-commit hooks
- `CONTRIBUTING.md` / changeset usage docs
- Publishing a new npm version (toolchain only — `0.0.1` stays until first feature ships)

## Capabilities

### New Capabilities
None — pure infrastructure change. No spec-level behavior.

### Modified Capabilities
None.

## Approach

Per exploration (`sdd/bootstrap-toolchain/explore`): adopt Biome + tsup + Vitest projects + Changesets. Land in one PR. Smoke-test the binary after first build to confirm tsup preserves the shebang.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | devDeps, scripts, `bin`, `files` |
| `bin/peel.mjs` | Removed | Replaced by tsup output `dist/index.js` |
| `src/index.ts` | New | CLI entrypoint with shebang |
| `tsconfig.json` | New | Strict NodeNext config |
| `tsup.config.ts` | New | Build config |
| `vitest.config.ts` | New | Test config (projects) |
| `biome.json` | New | Lint + format config |
| `.changeset/config.json` | New | Release config |
| `.github/workflows/ci.yml` | New | CI matrix |
| `.gitignore` | Modified | Add `dist/`, `coverage/` |
| `README.md` | Modified | Development section |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| tsup shebang quirk | Low | Smoke test `node dist/index.js` after first build; fallback to `banner` option |
| Biome adoption regret | Low | Swap to ESLint+Prettier later if needed; low lock-in |
| Changesets feels heavy for solo dev | Med | Document once; swap to `np` later if friction grows |
| Node 22 ESM resolution edge cases | Low | CI matrix catches Node 20 vs 22 differences early |

## Rollback Plan

Single-PR change. Revert the merge commit on `main`. The placeholder package on npm (`@tanisjam/peel@0.0.1`) is unaffected — no new version is published as part of this change.

## Dependencies

None external. All new dev dependencies installed via the same PR.

## Success Criteria

- [ ] `npm install` succeeds clean
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` produces `dist/index.js` with executable shebang
- [ ] `node dist/index.js` prints the placeholder message
- [ ] `npm run test` passes (with at least one smoke test in each project)
- [ ] CI workflow green on Node 20 + 22, ubuntu + macos
- [ ] `/sdd-init` re-run flips `strict_tdd: true` (post-merge)
