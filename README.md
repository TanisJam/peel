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
