# Exploration: bootstrap-toolchain

> Set up the TypeScript + tsup + vitest + lint/format + release tooling that the rest of the peel CLI work will sit on top of.

## Current State

The repo is a placeholder: `package.json` (no deps, no scripts), `bin/peel.mjs` (a 2-line "coming soon" script), README, LICENSE, .gitignore, and the PRD (`peel-cli-prd.md`).

There is **no** TypeScript, **no** test runner, **no** linter, **no** build step. Strict TDD is OFF in `openspec/config.yaml` because there's nothing to run tests with.

`peel-cli-prd.md` §10 specifies the planned stack: TypeScript strict, ESM, target Node 20+, build with tsup, tests with vitest, dependencies including `commander`, `@clack/prompts`, `fuzzysort`, `picocolors`, `execa`, `zod`, `yaml`, `get-port`. PRD §12 mentions `changesets` for releases but is not prescriptive.

## Affected Areas

- `package.json` — gets full dev toolchain (devDeps + scripts), `bin` repointed at `dist/`, `files: ["dist"]`
- `bin/peel.mjs` — **deleted**. The bin will be the tsup output `dist/index.js` going forward.
- `src/index.ts` — **new**. CLI entrypoint with `#!/usr/bin/env node` shebang. Initially keeps the "coming soon" message; real commands land in subsequent changes.
- `tsconfig.json` — **new**. Strict, ESM, NodeNext.
- `tsup.config.ts` — **new**. Bundle to ESM, target Node 20, preserve shebang, no dts.
- `vitest.config.ts` — **new**. Two projects: `unit` and `integration`. Integration timeout bumped (≥ 30 s).
- `biome.json` — **new** (assuming Biome wins — see below).
- `.gitignore` — append `dist/` and `coverage/`.
- `.github/workflows/ci.yml` — **new**. Lint + typecheck + test on Node 20 and 22, macOS + Linux.
- `.changeset/config.json` — **new** (assuming changesets wins).
- `README.md` — quick `Development` section: install, dev, build, test, release.

## Approaches

The change is really five smaller decisions. Each has a default; I'm comparing the live options below.

### Decision 1 — Linter / Formatter

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **Biome** | Single binary, Rust-fast, lint+format combined, zero config to start, native TS+ESM, batteries included | Smaller plugin ecosystem; some niche rules unavailable | Low |
| ESLint v9 (flat config) + Prettier | Massive ecosystem, every rule under the sun | Two tools, slow, flat-config migration churn, more deps | Medium |

**Recommendation: Biome.** For a single-package CLI in 2026, a single fast tool with sane defaults is the better tradeoff. We don't need ESLint plugins for React/Next/etc. — this is a Node CLI.

### Decision 2 — Build (tsup config shape)

PRD already picks tsup. The decision is just config:

- `entry: ['src/index.ts']`
- `format: ['esm']`
- `target: 'node20'`
- `clean: true`
- `dts: false` (CLI, not a library — no consumer types)
- `bundle: true` (single-file output for fast startup)
- `minify: false` (better stack traces; size doesn't matter for a CLI)
- `splitting: false`
- Shebang: tsup preserves `#!/usr/bin/env node` from the entry file automatically (since v6).

No real alternatives worth comparing. tsup is the right call.

### Decision 3 — TypeScript config

Strict baseline:
- `"target": "ES2022"`, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`
- `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`
- `"verbatimModuleSyntax": true`, `"isolatedModules": true`
- `"skipLibCheck": true`, `"resolveJsonModule": true`
- `"outDir"` not used (tsup builds; tsc is only for `--noEmit`)

`tsc --noEmit` for typecheck only. tsup handles the actual emit.

### Decision 4 — Vitest layout

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **Single config with `projects` (unit + integration)** | One config file, separate timeouts, can run all or one (`vitest --project unit`) | Slight extra ceremony in config | Low |
| Two separate configs (`vitest.config.ts` + `vitest.integration.config.ts`) | Total isolation | Two files, two scripts, easy to drift | Low |
| One config, mark integration via tag (`describe.concurrent`) | Simplest | No way to run one suite alone, shared timeout | Low |

**Recommendation: projects.** Integration tests need a real git repo via `tmp-promise` (PRD §11) — they're slow and need a 30 s+ timeout. Splitting projects keeps unit feedback fast (<1 s) and lets CI run them as separate steps.

Layout:
- Unit: `src/**/*.test.ts` — fast, no I/O.
- Integration: `test/**/*.integration.test.ts` — real git, real fs.

### Decision 5 — Release tooling

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **Changesets** | Auto changelog, PR-based release flow, well-trodden GH Action, contributor-friendly | A `.changeset/` per change feels heavy for solo dev on a single package | Low-Medium |
| `np` (sindresorhus) | Nice interactive UX, runs checks before publish, opens release notes editor | Requires interactive terminal — no CI release; manual changelog | Low |
| `release-it` | Configurable, plugin ecosystem (incl. changelog from conventional commits) | Heavier than `np`; another config file | Medium |
| Manual (`npm version` + `npm publish`) | Zero deps | Easy to skip steps, no changelog | Low |

**Recommendation: Changesets.**

Why, even though it feels heavy for solo:
1. PRD §12 explicitly mentions it.
2. The repo is **public** — future contributors get a standard "add a changeset to your PR" flow they likely already know.
3. Auto-generated `CHANGELOG.md` is real value for CLI users who skim release notes.
4. The official `changesets/action` GH Action is dead-simple to wire up.

The alternative I'd consider if you want lighter: skip changesets, use conventional commits + a `release.yml` workflow that runs `npm version` based on commit prefix. But that's reinventing the wheel.

## Recommendation

Adopt the toolchain in this order:

1. **TypeScript + tsup** — minimum viable build (delete `bin/peel.mjs`, add `src/index.ts`, tsconfig, tsup.config.ts, point `bin` at `dist/`).
2. **Biome** — lint + format in one tool.
3. **Vitest with projects** — unit + integration split, real git for integration.
4. **CI workflow** — lint + typecheck + test matrix (Node 20 / 22, ubuntu / macos).
5. **Changesets** — release automation, public-repo-friendly.

After this lands: re-run `/sdd-init` to flip `strict_tdd: true`, then start the next change with TDD active.

## Risks

1. **tsup shebang quirks** — confirmed preserved since v6, but worth a smoke test (`node dist/index.js` after first build) before declaring victory. If it breaks, fallback is the `banner` option.
2. **Biome adoption** — if a future contributor strongly prefers ESLint+Prettier, swapping later is straightforward. Low lock-in.
3. **Changesets ceremony** — solo dev might find the `.changeset/` flow annoying. Mitigation: document it once in `CONTRIBUTING.md` and move on. If it becomes a real friction point, swap to `np` later (single-script change).
4. **Node 20 vs 22 in CI** — both should pass, but Node 22 has stricter ESM resolution edges. Worth catching early; that's why both are in the matrix.
5. **No husky / lint-staged in scope** — pre-commit hooks intentionally deferred. CI catches everything; local hooks can be added later if drift becomes a problem.

## Ready for Proposal

**Yes.** All five decisions have a clear recommendation. The next phase (proposal) should formalize these as a single change with the full file inventory and a rollback plan. Tell the user: "Explore done — recommended Biome + tsup + Vitest projects + Changesets. Ready to move to proposal?"
