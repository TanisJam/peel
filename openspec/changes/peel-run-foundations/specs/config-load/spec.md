# config-load Specification

## Purpose

Read a `.peel.yml` from the user's repo, merge it with the canonical defaults, validate the result against the schema, and surface friendly errors so other commands can rely on a complete, schema-valid `Config` object.

## Requirements

### Requirement: Locate Config

The system MUST search for `.peel.yml` starting at the caller's `cwd` and walking upward to the git root. The first match wins.

#### Scenario: Reads .peel.yml from cwd
- GIVEN a directory containing a valid `.peel.yml`
- WHEN `loadConfig(cwd)` runs
- THEN the returned `Config` reflects that file merged with defaults

#### Scenario: Walks up to the git root to find the config
- GIVEN `.peel.yml` exists at the git root and `cwd` is a nested subdirectory
- WHEN `loadConfig(cwd)` runs
- THEN the parent file is loaded

#### Scenario: Returns null when no config exists
- GIVEN no `.peel.yml` exists between `cwd` and the git root
- WHEN `loadConfig(cwd)` runs
- THEN it returns `null`

### Requirement: Merge With Defaults

The system MUST produce a complete `Config` by deep-merging the user-written partial YAML over `DEFAULT_CONFIG`. Missing fields MUST take their default values; arrays from the file MUST replace (not concat) the default arrays.

#### Scenario: Missing fields fall back to defaults
- GIVEN a `.peel.yml` containing only `packageManager: pnpm`
- WHEN `loadConfig(cwd)` returns
- THEN `port.base === 3000` AND `commands.dev === DEFAULT_CONFIG.commands.dev`

#### Scenario: Arrays from the file replace default arrays
- GIVEN `.peel.yml` sets `envFiles: ['.env.local']`
- WHEN merged
- THEN the resulting `envFiles` is exactly `['.env.local']`

### Requirement: Validate Config

The system MUST validate the merged result against `ConfigSchema` and throw a friendly `PeelConfigError` whose message references the failing field path on validation failure. Malformed YAML MUST throw a distinct `PeelConfigError` whose message names the file path.

#### Scenario: Schema-invalid value rejected
- GIVEN a `.peel.yml` with `port: { base: "three-thousand", strategy: "fixed" }`
- WHEN `loadConfig(cwd)` runs
- THEN it throws `PeelConfigError` mentioning `port.base`

#### Scenario: Malformed YAML rejected
- GIVEN a `.peel.yml` containing `: : :`
- WHEN `loadConfig(cwd)` runs
- THEN it throws `PeelConfigError` naming the file path
