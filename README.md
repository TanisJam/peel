# peel

> Ephemeral git worktrees with auto-managed dev servers.

`peel` lets you spin up any branch in an isolated git worktree with its own
`node_modules`, a copied `.env`, and a free port — and tear it all down on Ctrl+C.

Published as `@tanisjam/peel` (the bare `peel` name is squatted on npm). The
binary on your terminal is still `peel`.

```bash
peel init               # one-time setup per repo
peel                    # interactive: pick branch, pick mode, go
peel run feature/x dev  # direct, no prompts
peel list               # show active worktrees
peel clean --stale      # cleanup orphans
```

## Usage

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
peel run                    # interactive: type-to-filter branch picker, then pick mode
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

### Manage worktrees

```bash
peel list                    # show all peel-managed worktrees
peel clean feature/x         # remove a single worktree
peel clean --all             # remove all peel-managed worktrees (with confirmation)
peel clean --all --yes       # same, no prompt
peel clean --stale           # remove worktrees whose branch no longer exists locally or remotely
```

`peel list` shows branch, path, age, and status. Status is `running` when a `peel.lock`
file in the worktree points at a live PID, `idle` otherwise.

`peel clean` defaults to safe behavior: bulk modes (`--all`, `--stale`) skip running
worktrees and report them in the summary. Single-target `peel clean <branch>` warns
but proceeds — explicit user intent.

The `--stale` mode runs a best-effort `git fetch` first (unless `--no-fetch` is passed
or `git.fetchOnStart: false` in `.peel.yml`); on fetch failure it computes staleness
from the local view and prints a warning.

### Configure

```bash
peel config show     # print the merged config (defaults + overrides) as YAML
peel config path     # print the absolute path of .peel.yml
peel config edit     # open .peel.yml in $VISUAL or $EDITOR
```

`peel config show` prints the merged view — every field with its effective value — so
you see exactly what `peel run` will use. To inspect the raw file, use
`cat $(peel config path)`.

`peel config path` always prints a path (the file's location, or where it would be
created). Exit code 0 when the file exists, 1 when it does not — useful for
scripting:

```bash
if peel config path > /dev/null 2>&1; then
  echo "configured"
fi
```

`peel config edit` resolves the editor as `$VISUAL`, then `$EDITOR`. It refuses to
spawn when `.peel.yml` is missing (run `peel init` first) or when no editor is
configured.

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
