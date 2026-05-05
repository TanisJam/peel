# @tanisjam/peel

## 0.1.1

### Patch Changes

- Polish patch based on first-user feedback on 0.1.0.

  - Wizard now shows the default value as a placeholder in every text prompt — no more empty boxes; press Enter and you get the visible default. Pre-run hooks shows `(none)`.
  - After `peel init` succeeds, a "Next steps" block prints concrete examples: `peel run feature/x dev`, `peel list`, plus a fallback hint for users who hit `command not found: peel` after an `npx`-only init. The message tailors to whether you invoked via npx or a global install.
  - README install section updated to recommend `npm install -g @tanisjam/peel` and clarify the npx alternative.
  - Default banner drops the "coming soon" placeholder-era wording.
  - `package.json` bin path normalized (`./dist/index.js` → `dist/index.js`); npm no longer emits the "script name was cleaned" warning at publish time.

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
