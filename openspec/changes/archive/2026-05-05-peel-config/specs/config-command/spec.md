# config-command Specification

## Purpose

`peel config` is the user-facing surface for inspecting and editing `.peel.yml`. Three subcommands: `show` (print merged YAML), `path` (print absolute path), `edit` (open in `$EDITOR`).

## Requirements

### Requirement: Show Merged Config as YAML

The system MUST print the merged Config (defaults + user overrides) as valid YAML to stdout and exit 0. The output MUST round-trip through `loadConfig` with the same effective values.

#### Scenario: Prints merged config when .peel.yml exists

- GIVEN a `.peel.yml` with `port.base: 4200`
- WHEN the user runs `peel config show`
- THEN stdout is valid YAML containing `port:` with `base: 4200`
- AND every default field is present (e.g. `commands.install`, `worktree.baseDir`)
- AND exit code is 0

#### Scenario: Missing config

- GIVEN no `.peel.yml` at the repo root
- WHEN the user runs `peel config show`
- THEN stderr contains a message that mentions `peel init`
- AND exit code is non-zero

### Requirement: Print Config Path

The system MUST print the absolute path of `.peel.yml` to stdout. The exit code MUST be 0 when the file exists and non-zero when it does not.

#### Scenario: Path of existing config

- GIVEN a `.peel.yml` at the git root
- WHEN the user runs `peel config path`
- THEN stdout contains the absolute path ending in `/.peel.yml`
- AND the path resolves to an existing file
- AND exit code is 0

#### Scenario: Would-be path when missing

- GIVEN no `.peel.yml` but the cwd is inside a git repo
- WHEN the user runs `peel config path`
- THEN stdout contains the absolute path where the file WOULD live (`<gitRoot>/.peel.yml`)
- AND exit code is non-zero

#### Scenario: Outside a git repo

- GIVEN the cwd is not inside any git repo
- WHEN the user runs `peel config path`
- THEN stderr contains a message that mentions `peel init` or that no git repo was found
- AND exit code is non-zero

### Requirement: Edit Config in $EDITOR

The system MUST resolve the editor as `$VISUAL` first, then `$EDITOR`, then fail. The system MUST spawn the editor with the absolute path to `.peel.yml` as its argument and inherit stdio so the editor controls the terminal. The exit code from the editor MUST be propagated.

#### Scenario: Spawns editor and propagates exit 0

- GIVEN a `.peel.yml` exists and `$EDITOR` is set to a command that exits 0
- WHEN the user runs `peel config edit`
- THEN the editor is spawned with the config path as its argument
- AND exit code is 0

#### Scenario: Propagates non-zero editor exit

- GIVEN a `.peel.yml` exists and `$EDITOR` is set to a command that exits 7
- WHEN the user runs `peel config edit`
- THEN exit code is 7

#### Scenario: Prefers $VISUAL over $EDITOR when both set

- GIVEN both `$VISUAL` and `$EDITOR` are set to different commands
- WHEN the user runs `peel config edit`
- THEN the `$VISUAL` command is spawned, not `$EDITOR`

#### Scenario: No editor configured

- GIVEN neither `$VISUAL` nor `$EDITOR` is set
- WHEN the user runs `peel config edit`
- THEN stderr contains a message that mentions `EDITOR`
- AND exit code is non-zero
- AND no process is spawned

#### Scenario: Missing config

- GIVEN no `.peel.yml` at the repo root
- WHEN the user runs `peel config edit`
- THEN stderr contains a message that mentions `peel init`
- AND exit code is non-zero
- AND no editor process is spawned
