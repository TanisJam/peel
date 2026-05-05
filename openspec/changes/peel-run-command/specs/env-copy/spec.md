# env-copy Specification

## Purpose

Copy a configured list of env files from the main repo into a newly-created worktree so the spawned dev/build process has the same environment without leaking secrets into git history.

## Requirements

### Requirement: Copy Files

The system MUST copy each listed env file from the source repo to the destination worktree, byte-for-byte. It MUST skip any file that already exists at the destination. It MUST report missing source files without throwing.

#### Scenario: Copies present, skips existing, reports missing
- GIVEN source has `.env`, `.env.local`; dest already has `.env.local`; the list is `[".env", ".env.local", ".env.test"]`
- WHEN `copyEnvFiles({ src, dest, files })` runs
- THEN it returns `{ copied: [".env"], skipped: [".env.local"], missing: [".env.test"] }`
- AND the dest `.env` matches the source byte-for-byte

#### Scenario: Empty list is a no-op
- GIVEN `files: []`
- WHEN `copyEnvFiles(...)` runs
- THEN it returns `{ copied: [], skipped: [], missing: [] }` without touching the dest
