# Design: Bootstrap Toolchain

## Technical Approach

Land the full dev toolchain in one PR. tsup emits a single ESM bundle to `dist/index.js`; tsc only type-checks (`--noEmit`); Vitest runs unit + integration projects with separate timeouts; Biome handles lint + format; Changesets owns versioning; GitHub Actions runs the matrix on every PR. After merge, re-run `/sdd-init` so Strict TDD flips on for the next change.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Module system | NodeNext (TS) + ESM (tsup) | Matches Node 20+ runtime resolution exactly; no bundler shims to debug later |
| TS emit | `noEmit: true`; tsup emits | One source of truth for build; tsc kept for type-checking only |
| Bundle vs files | `bundle: true`, `splitting: false` | CLI cold-start matters; one file = no runtime resolution cost |
| Type declarations | `dts: false` | CLI binary has no library consumers — types would be dead weight |
| Sourcemaps | `sourcemap: true` | Stack traces from `dist/` map back to `src/`; cheap and useful for users reporting bugs |
| Minify | `false` | Readable stack traces > shaving 100 KB on a CLI |
| Test split | Vitest `projects` (one config) | One file, two timeouts, single-suite targeting via `--project` |
| Integration timeout | 30 s | `git init` + worktree + install in tmp dirs is slow; 30 s leaves headroom |
| Linter | Biome | Single fast tool; rejected ESLint+Prettier (two tools, slow, no plugin needs for a Node CLI) |
| Release | Changesets | PRD-mandated; public repo benefits from auto-changelog and standard contributor flow |
| Pre-commit hooks | None (deferred) | CI is the safety net for v0; husky/lint-staged can land later if drift appears |

## File Changes

| File | Action | Notes |
|---|---|---|
| `src/index.ts` | Create | Shebang + placeholder message |
| `tsconfig.json` | Create | NodeNext + strict + noEmit |
| `tsup.config.ts` | Create | ESM bundle, target node20 |
| `vitest.config.ts` | Create | Two projects |
| `biome.json` | Create | Lint + format combined |
| `.changeset/config.json` | Create | Public access, main branch |
| `.github/workflows/ci.yml` | Create | Matrix Node 20/22 × ubuntu/macos |
| `package.json` | Modify | devDeps + scripts; `bin` → `dist/index.js`; `files: ["dist"]` |
| `bin/peel.mjs` | Delete | Replaced by tsup output |
| `.gitignore` | Modify | `+ dist/`, `+ coverage/` |
| `README.md` | Modify | Append Development section |

## Concrete Configs

**`devDependencies` (ranges; lockfile pins exact)**:
- `typescript: ^5.6`
- `@types/node: ^20`
- `tsup: ^8.3`
- `vitest: ^2.1`
- `@biomejs/biome: ^1.9`
- `@changesets/cli: ^2.27`

**`tsconfig.json`** — NodeNext + strict baseline:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*", "test/**/*", "*.config.ts"],
  "exclude": ["node_modules", "dist", "coverage"]
}
```

**`tsup.config.ts`**:
```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  bundle: true,
  splitting: false,
  clean: true,
  dts: false,
  minify: false,
  sourcemap: true,
  shims: false,
});
```

**`vitest.config.ts`**:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      { test: { name: "unit", include: ["src/**/*.test.ts"], environment: "node" } },
      {
        test: {
          name: "integration",
          include: ["test/**/*.integration.test.ts"],
          environment: "node",
          testTimeout: 30_000,
        },
      },
    ],
  },
});
```

**`biome.json`**:
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "files": { "ignore": ["dist", "coverage", "node_modules", ".changeset"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100, "lineEnding": "lf" },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": { "useNodejsImportProtocol": "error", "useImportType": "error" },
      "suspicious": { "noConsoleLog": "off" }
    }
  },
  "javascript": {
    "formatter": { "quoteStyle": "double", "semicolons": "always", "trailingCommas": "all" }
  }
}
```

`noConsoleLog: off` — this is a CLI; `console.log` is the legitimate output channel.

**`.changeset/config.json`**:
```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

**`.github/workflows/ci.yml`**:
```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
  test:
    name: ${{ matrix.os }} / Node ${{ matrix.node }}
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest]
        node: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ matrix.node }}', cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build
      - run: npm test
```

**`package.json` scripts**:
```json
{
  "dev": "tsup --watch",
  "build": "tsup",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:unit": "vitest run --project unit",
  "test:integration": "vitest run --project integration",
  "lint": "biome check .",
  "lint:fix": "biome check --write .",
  "format": "biome format --write .",
  "typecheck": "tsc --noEmit",
  "prepublishOnly": "npm run lint && npm run typecheck && npm run test && npm run build",
  "release": "changeset publish"
}
```

`bin` becomes `{ "peel": "./dist/index.js" }`. `files` becomes `["dist"]`.

**`src/index.ts`**:
```ts
#!/usr/bin/env node
console.log("peel — coming soon.");
console.log(
  "Spin up any branch in an isolated git worktree, with its own node_modules, env, and port.",
);
```

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit | Toolchain wiring (one smoke test) | `src/index.test.ts` — assert exported version string or trivial pure fn |
| Integration | One smoke test that exists | `test/smoke.integration.test.ts` — placeholder spawning the built binary; real CLI integration tests come with the first command |
| E2E | None | Out of scope |

## Migration / Rollout

No migration. New dev infrastructure only. After merge, the orchestrator re-runs `/sdd-init` to flip `strict_tdd: true`.

## Open Questions

None. All five exploration decisions ratified.
