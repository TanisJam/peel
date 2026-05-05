# Skill Registry — peel

Auto-resolved skills available for sub-agent delegation in this project.

## Project Conventions

- **Global instructions**: `~/.claude/CLAUDE.md` (user-level — loaded for all projects)
- **Project instructions**: none (no project-level CLAUDE.md, AGENTS.md, or .cursorrules)
- **PRD**: `peel-cli-prd.md` — full product requirements, drives the SDD work

## Compact Rules

### Global rules (apply to all sub-agents)
- Use conventional commits only. Never add "Co-Authored-By" or AI attribution.
- Never run a build after changes (per user preference).
- Use `bat` / `rg` / `fd` / `sd` / `eza` instead of `cat` / `grep` / `find` / `sed` / `ls`.
- Match the user's language (Rioplatense Spanish in this project).
- Verify technical claims before stating them. Do not agree with user claims without verification.

### Project rules (peel)
- The npm package name is `@tanisjam/peel` (scoped — `peel` itself is squatted).
- Terminal binary is `peel` (set via `bin` map in package.json).
- TypeScript ESM only. Target Node ≥ 20.
- Public repo — `peel-cli-prd.md` is part of the public design history.
- Tests via vitest (once installed). Integration tests must use real git via `tmp-promise` (per PRD §11), not mocked.

## User Skills (relevant to this project)

| Skill | Trigger context | Usage |
|-------|-----------------|-------|
| `branch-pr` | Creating a pull request | PR workflow with issue-first enforcement |
| `issue-creation` | Creating a GitHub issue, reporting a bug, requesting a feature | Issue workflow |
| `simplify` | Reviewing changed code for reuse / quality | Post-implementation cleanup |
| `judgment-day` | Adversarial dual review | Critical changes, architecture |
| `security-review` | Security review of pending changes | Pre-release |
| `review` | Reviewing a pull request | Code review |
| `skill-creator` | Creating new agent skills | If we extract reusable patterns |

## Skills NOT relevant

- `go-testing` — project is TypeScript, not Go
- `claude-api` — peel does not use the Anthropic SDK

## SDD Skills

All `sdd-*` skills are available and managed by the orchestrator. See `~/.claude/CLAUDE.md` Agent Teams Lite section for the full workflow.

## Persistence

- **Engram**: active. All decisions, bug fixes, and discoveries saved with `project: "peel"`.
- **Openspec**: active. Artifacts in `openspec/`.
- Mode: hybrid by default (engram for cross-session recall + openspec for committed history).
