# Tasks: harden-cleanup + fuzzy-picker

> Strict TDD active. Real fs/git/process via `tmp-promise` + `child_process.spawn`. No mocks. `FakePrompter` is a fake (scripted), not a mock.

## Phase A — SIGINT integration

- [x] A.1 Build the binary if not fresh: `npm run build`.
- [x] A.2 RED: `test/run-sigint.integration.test.ts` — fixture writes `.peel.yml` with `dev: "node -e 'console.log(\"PEEL_TEST_READY\");setInterval(()=>{},1000)'"`. Spawn `peel run feature/x dev --yes --no-fetch` via `child_process.spawn` with stdout pipe. Wait for `PEEL_TEST_READY` line. Send `child.kill('SIGINT')`. Await `child.on('exit', ...)`. Assert (a) `code === 130 || signal === 'SIGINT'`, (b) `existsSync(siblingWorktreePath) === false`.
- [x] A.3 GREEN: run the test against existing production code. If it passes, no production change needed (cleanup path is correct). If it fails, fix `cleanup.ts`/`run-flow.ts` minimally.
- [x] A.4 TRIANGULATE: add a second case — `peel run feature/x dev --yes --no-fetch --keep` then SIGINT — assert worktree DOES still exist (proves `--keep` is honored under SIGINT).

## Phase B — fuzzy-picker (autocomplete)

- [x] B.1 RED: extend `src/core/__fixtures__/fake-prompter.test.ts` — add tests asserting `FakePrompter.autocomplete` returns scripted value, throws on script exhaust, throws on kind mismatch.
- [x] B.2 GREEN: add `autocomplete` to the `Prompter` interface in `src/ports/prompter.ts` (signature: `autocomplete<T>(opts: {message, options, initialValue?, placeholder?}) → Promise<T | Cancel>`); add `AutocompleteOption<T>` type.
- [x] B.3 GREEN: extend `FakePrompter` with `autocomplete` step kind + handler.
- [x] B.4 GREEN: add `ClackPrompter.autocomplete` adapter delegating to `clack.autocomplete`. TypeScript-only patch — no behavior test (covered by integration smoke).
- [x] B.5 RED (already existing scenarios; SHOULD start failing): update `src/core/branch-picker.test.ts` script entries from `select` → `autocomplete`.
- [x] B.6 GREEN: change `src/core/branch-picker.ts` — replace `prompter.select(...)` with `prompter.autocomplete(...)`. Keep cancel + return contract. Add `placeholder: "Type to filter…"`.
- [x] B.7 TRIANGULATE: verify `src/core/run-flow.test.ts` (which scripts a select for the mode picker — `select` stays, only branch-picker switched) still passes; if it scripted a branch select, update it.

## Phase C — gates + docs

- [x] C.1 README — add "Type to filter the branch list" sentence in the Run section.
- [x] C.2 Run full gates: lint, typecheck, build, test (220+1+1 = 222 expected; full integration matrix locally).
- [x] C.3 Final `git status` — no stray tmp/lock files; nothing accidentally staged.
