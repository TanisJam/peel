# Tasks: first-release (0.1.0)

> Metadata-only change. No new tests; existing `prepublishOnly` is the gate. Tasks split into pre-merge (orchestrator) and post-merge (orchestrator after maintainer's `npm publish`).

## Phase 1: Pre-merge — author the bump

- [x] 1.1 Author `.changeset/release-0-1-0.md` with frontmatter `"@tanisjam/peel": minor` and the body from `design.md > Changeset content`.
- [x] 1.2 Run `npx changeset version` — verify it bumps `package.json` to `0.1.0`, generates `CHANGELOG.md`, and removes the consumed changeset file.
- [x] 1.3 Edit `src/version.ts` — set `VERSION = "0.1.0"` to match `package.json`.
- [x] 1.4 Edit `package.json` `description` — drop "Work in progress." sentence; keep the rest.
- [x] 1.5 Edit `README.md` intro — replace the "Work in progress / placeholder" paragraph with the version from `design.md > README intro replacement`.
- [x] 1.6 Run `npm run prepublishOnly` — assert lint, typecheck, test, and build all pass.
- [x] 1.7 Local smoke: `node dist/index.js --version` prints `0.1.0`.
- [x] 1.8 Final `git status` review — only the 5 expected files show changes (changeset removed, package.json, version.ts, CHANGELOG.md created, README.md).

## Phase 2: Pre-merge — open PR

- [x] 2.1 Commit on `release/0.1.0` branch with conventional message: `chore(release): 0.1.0 — first MVP release`.
- [x] 2.2 Push branch and open PR titled "chore(release): 0.1.0 — first MVP release"; body summarises the changeset content and includes the post-merge checklist.
- [x] 2.3 Wait for CI matrix to go green (4 jobs + GitGuardian).
- [x] 2.4 STOP — hand off to maintainer for merge + `npm publish`.

## Phase 3: Post-merge — tag + GitHub release

> Run only AFTER maintainer reports `npm publish --access public` succeeded.

- [x] 3.1 Sync local: `git checkout main && git pull --ff-only`.
- [x] 3.2 Verify the tag does not yet exist: `git tag -l v0.1.0` is empty.
- [x] 3.3 Create annotated tag: `git tag -a v0.1.0 -m "v0.1.0 — first MVP release"`.
- [x] 3.4 Push the tag: `git push origin v0.1.0`.
- [x] 3.5 Extract the 0.1.0 section of CHANGELOG.md into a temp file (skip the trailing `## ` of the next entry if any).
- [x] 3.6 Create GitHub release: `gh release create v0.1.0 --title "v0.1.0" --notes-file <tempfile>`.
- [x] 3.7 Confirm release URL is reachable: `gh release view v0.1.0 --web` (or `--json url`).

## Phase 4: Post-publish smoke

- [x] 4.1 In a fresh shell (or `npx --userconfig /tmp/_npmrc` to bypass cache), run `npx -y @tanisjam/peel@0.1.0 --version`. Assert stdout is `0.1.0`.
- [x] 4.2 Confirm `npm view @tanisjam/peel@0.1.0 version` returns `0.1.0`.

## Phase 5: Final review

- [x] 5.1 README intro reads cleanly without the "Work in progress" wording.
- [x] 5.2 CHANGELOG.md has the 0.1.0 entry with the changeset's bullet list.
- [x] 5.3 GitHub release page displays the same content.
- [x] 5.4 No leftover `.changeset/release-0-1-0.md` (consumed).
