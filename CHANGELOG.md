# @tanisjam/peel

## 0.1.0

### Minor Changes

- First real MVP release.

  - `peel init` — generate a minimal `.peel.yml` with detection of package manager, env files, scripts
  - `peel run [branch] [mode]` — spin up a branch in an isolated git worktree with its own `node_modules`, env, and free port; auto-cleanup on exit
  - `peel list` — table of peel-managed worktrees with branch, path, age, status
  - `peel clean [branch] [--all] [--stale]` — remove tool-created worktrees safely (skips running on bulk modes)
  - `peel config show|path|edit` — inspect, locate, or open the merged config
  - Type-to-filter (autocomplete) branch picker
  - SIGINT cleanup proven end-to-end via integration test

  Available on npm as `@tanisjam/peel` (the bare name `peel` is squatted). The terminal binary is `peel`.
