# peel

> Ephemeral git worktrees with auto-managed dev servers.

**Work in progress.** This package is a placeholder while the CLI is being built. The name `peel` on npm is squatted, so this is published as `@tanisjam/peel` — the binary on your terminal is still `peel`.

## Plan

`peel` will let you spin up any branch in an isolated git worktree with its own `node_modules`, a copied `.env`, and a free port — and tear it all down on Ctrl+C.

```bash
peel init               # one-time setup per repo
peel                    # interactive: pick branch, pick mode, go
peel run feature/x dev  # direct, no prompts
peel list               # show active worktrees
peel clean --stale      # cleanup orphans
```

Stay tuned.

## Usage (current)

```bash
npx @tanisjam/peel init        # interactive wizard, generates .peel.yml
npx @tanisjam/peel init --yes  # non-interactive, uses detected defaults
```

The wizard auto-detects:

- **Package manager** — picks the lockfile present (`pnpm-lock.yaml` > `bun.lock` > `yarn.lock` > `package-lock.json`); honors Corepack's `packageManager` field if set.
- **Env files** — every `.env*` in the repo root (excluding `*.example` and `*.sample`).
- **Scripts** — `dev`, `build`, and `start` from your `package.json`.

The output `.peel.yml` is **minimal**: only fields that differ from the canonical defaults are written. Two runs over the same answers produce byte-identical files.

### Run a branch

```bash
peel run feature/x dev      # spin up feature/x in a worktree, run dev
peel run feature/x build    # build mode
peel run                    # interactive: pick branch + mode
peel run feature/x dev -k   # --keep: don't remove the worktree on exit
peel run --port 4200        # override the base port
peel run --no-fetch         # skip the initial git fetch
```

What happens on `peel run`:

1. Loads `.peel.yml`. Bails if missing.
2. `git fetch --prune` (best-effort; survives offline).
3. Lists branches; prompts if no branch given.
4. Verifies the port. `fixed` strategy fails fast with a friendly error pointing at the holding PID. `auto-find` walks the next 20 ports.
5. Creates a `git worktree` at `<baseDir>/<repoName>-<slug(branch)>`.
6. Copies the configured env files (skips files that already exist at the destination).
7. Runs the install command (skipped on `--keep` reuse if `node_modules` exists).
8. Runs configured pre-run hooks sequentially. Stops on first failure with a friendly error.
9. Spawns the dev/build command with stdio inherited.
10. On exit (clean or Ctrl+C), removes the worktree unless `--keep` is set.

Other subcommands (`list`, `clean`, `config`) — coming next.

## Development

Prerequisites: Node ≥ 20, npm.

```bash
npm install         # install deps
npm run dev         # tsup watch mode
npm run build       # produces dist/index.js
npm test            # vitest: unit + integration
npm run test:unit   # unit only
npm run test:integration  # integration only (slower; spawns the built binary)
npm run lint        # biome check
npm run lint:fix    # biome check --write
npm run typecheck   # tsc --noEmit
```

### Releases

Releases use [Changesets](https://github.com/changesets/changesets):

```bash
npx changeset       # add a changeset describing your change
# ...PR + merge to main, then:
npm run release     # changeset publish (CI or maintainer)
```

## License

MIT
