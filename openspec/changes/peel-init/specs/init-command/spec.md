# init-command Specification

## Purpose

`peel init` writes a minimal, valid `.peel.yml` at the repo root by combining auto-detected project conventions with answers from an interactive wizard. The command works in interactive and non-interactive (`--yes`) modes, refuses to clobber unconfirmed configs, and never leaves a partial file behind.

## Requirements

### Requirement: Package Manager Detection

The system MUST detect the project's package manager. The `packageManager` field in the target `package.json` (Corepack) MUST take precedence over lockfile sniffing. When absent, the system MUST sniff lockfiles in this precedence: `pnpm-lock.yaml` > `bun.lock` / `bun.lockb` > `yarn.lock` > `package-lock.json`. When none match, the system MUST default to `npm`.

#### Scenario: Corepack field overrides lockfiles
- GIVEN a repo with `pnpm-lock.yaml` present AND `package.json#packageManager` set to `yarn@4.0.0`
- WHEN the detector runs
- THEN it returns `yarn`

#### Scenario: pnpm wins on lockfile collision
- GIVEN a repo with both `pnpm-lock.yaml` and `package-lock.json`
- WHEN the detector runs
- THEN it returns `pnpm`

#### Scenario: Defaults to npm
- GIVEN a repo with no lockfile and no `packageManager` field
- WHEN the detector runs
- THEN it returns `npm`

### Requirement: Env File Detection

The system MUST list every file matching `.env*` in the repo root, excluding suffixes `.example` and `.sample`. Hidden files outside the repo root MUST NOT be listed. The list MUST be alphabetically sorted.

#### Scenario: Includes loadable env files, excludes templates
- GIVEN repo root contains `.env`, `.env.local`, `.env.example`, `.env.production.sample`
- WHEN the detector runs
- THEN it returns `[".env", ".env.local"]`

### Requirement: Script Detection

The system MUST read the target `package.json` and return the values of the `scripts.dev`, `scripts.build`, and `scripts.start` fields when present. Missing scripts MUST be returned as `null`. A missing or unreadable `package.json` MUST cause the detector to return `null` for all three without throwing.

#### Scenario: Reads scripts from package.json
- GIVEN `package.json#scripts` = `{ "dev": "next dev", "build": "next build" }`
- WHEN the detector runs
- THEN it returns `{ dev: "next dev", build: "next build", start: null }`

### Requirement: Interactive Wizard

When invoked without `--yes`, the system MUST prompt — in this order — for: port strategy (`fixed` | `auto-find`), base port, env files to copy (multi-select pre-checked with detected files), package manager (pre-selected with detected), install command, dev command, build command, start command, pre-run hooks (multi-line), worktree base directory, and auto-cleanup default. Each prompt MUST surface the detected value as its default. The wizard SHALL exit cleanly without writing if any prompt is cancelled.

#### Scenario: Cancel does not write
- GIVEN the wizard is mid-flow
- WHEN the user cancels at any prompt
- THEN no file is written AND the exit code is `0`

### Requirement: Non-Interactive Mode

When invoked with `--yes`, the system MUST skip every prompt and use detected values plus schema defaults. The system MUST overwrite an existing `.peel.yml` without confirmation.

#### Scenario: --yes writes defaults silently
- GIVEN a repo with no `.peel.yml` and no detection signals beyond `package-lock.json`
- WHEN `peel init --yes` runs
- THEN `.peel.yml` is written, parses against the schema, and `packageManager: npm`

### Requirement: Existing-Config Confirmation

When `.peel.yml` already exists and `--yes` is not set, the system MUST ask the user to confirm overwrite. A negative answer MUST exit `0` without modifying the file.

#### Scenario: Refuse overwrite preserves the file
- GIVEN `.peel.yml` exists with content `X`
- WHEN the user picks "no" at the overwrite prompt
- THEN the file content is still `X` AND the process exits `0`

### Requirement: Minimal Output

The serialized `.peel.yml` MUST contain only fields whose value differs from the canonical defaults. Empty arrays, empty objects, and default scalars MUST be omitted. The file MUST end with a single trailing newline. The output MUST be deterministic for identical inputs.

#### Scenario: Identical inputs produce byte-identical output
- GIVEN the same answers run twice
- WHEN the writer serializes both
- THEN the resulting file bytes are identical

### Requirement: Pre-flight Validation

The system MUST exit non-zero with a friendly message when not run inside a git working tree. A missing `package.json` MUST NOT abort the command — the wizard MUST allow the user to type install/dev/build/start manually.

#### Scenario: Outside a git repo, refuse to run
- GIVEN the current directory is not inside any git repo
- WHEN `peel init` runs
- THEN the process exits non-zero with a message naming the missing precondition AND no file is written

### Requirement: Atomic Write

The system MUST write `.peel.yml` atomically: serialize fully into a temporary sibling file then `rename` over the target. A crash mid-write MUST NOT corrupt an existing `.peel.yml`.

#### Scenario: Crash mid-write preserves existing file
- GIVEN an existing `.peel.yml` with content `X`
- WHEN the writer is interrupted after writing the temp file but before rename
- THEN `.peel.yml` still contains `X`
