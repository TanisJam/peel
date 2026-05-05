# Design: peel-config

## Technical Approach

Three thin functions in `core/config-flow.ts` (`showConfig`, `configPath`, `editConfig`) compose existing primitives plus one additive export from `config-load.ts` (`findConfigPath`). `editConfig` injects a `Runner` so `FakeRunner` covers the spawn path. Commander dispatches `peel config <sub>` to `commands/config.ts`, which wires the real adapters. Mirrors the `runFlow` / `listFlow` / `cleanFlow` layering.

## Architecture Decisions

### Decision: Print MERGED config for `show`, not the raw file

**Choice**: `peel config show` prints the merged Config (defaults + overrides) as YAML.
**Alternatives**: print the raw `.peel.yml` content.
**Rationale**: PRD says "imprime el config actual en YAML" — the merged view is the truthful answer to "what will peel actually do". Users who want raw can use `peel config path | xargs cat`.

### Decision: `path` always prints, exit code distinguishes presence

**Choice**: `peel config path` always prints the absolute path; exits 0 when the file exists, 1 when not (would-be path).
**Alternatives**: (A) silent on missing; (B) error to stderr only when missing.
**Rationale**: Scriptable contract — `peel config path` always emits a string suitable for `cat`/`mv`. The exit code carries the presence bit. Matches `which`'s convention.

### Decision: `$VISUAL` first, then `$EDITOR`, then fail (no implicit `vi`)

**Choice**: Resolve editor as `$VISUAL || $EDITOR`; if neither set, surface a friendly error.
**Alternatives**: silently fall back to `vi`.
**Rationale**: Falling back to `vi` on machines without it produces a confusing error from execa. Explicit failure with a one-line guidance message is friendlier and matches Git's behavior.

### Decision: Reuse `yamlStringify` options from `config-write.ts`

**Choice**: Same options (`lineWidth: 100`, `indent: 2`, `defaultStringType: "PLAIN"`, `defaultKeyType: "PLAIN"`).
**Rationale**: Round-trip safety — `peel config show > .peel.yml` produces a file that loads identically.

### Decision: `editConfig` uses `runner.spawn`, not a new "interactive" runner method

**Choice**: Spawn the editor via the existing `Runner.spawn` (stdio inherited).
**Rationale**: That's exactly the semantic — long-lived child with terminal control. The same path `peel run` uses for the dev server. No port surface change.

## Data Flow

```
peel config show:
  loadConfig + findGitRoot ──→ yamlStringify(merged) ──→ stdout

peel config path:
  findConfigPath OR (findGitRoot + join "/.peel.yml") ──→ stdout
                                                              │
                                                  exit 0 if file exists, else 1

peel config edit:
  loadConfig (require) + findConfigPath ──→ resolve $VISUAL || $EDITOR
                                                       │
                                              runner.spawn(`<editor> <path>`)
                                                       │
                                                  await exited ──→ propagate exit code
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/core/config-load.ts` | Modify | Export `findConfigPath(cwd) → string \| null` (additive) |
| `src/core/config-flow.ts` | Create | `showConfig`, `configPath`, `editConfig` |
| `src/core/config-flow.test.ts` | Create | Real-fs unit tests with `tmp-promise` + `FakeRunner` |
| `src/commands/config.ts` | Create | Wires real adapters; dispatches show/path/edit |
| `src/commands/config.test.ts` | Create | Wiring + error formatting |
| `src/index.ts` | Modify | Register `config` parent + `show`/`path`/`edit` children |
| `test/config.integration.test.ts` | Create | End-to-end via shared fixture; uses a fake editor (`node -e "process.exit(0)"`) |
| `README.md` | Modify | "Configure" section |

## Interfaces / Contracts

```ts
// config-load.ts (additive)
export function findConfigPath(cwd: string): string | null;

// config-flow.ts
export type ConfigFlowOps = {
  loadConfig: (cwd: string) => Config | null;
  findGitRoot: (cwd: string) => string | null;
  findConfigPath: (cwd: string) => string | null;
};

export type ConfigFlowErrorKind = "no-config" | "no-git" | "no-editor";
export class ConfigFlowError extends Error {
  constructor(message: string, public readonly kind: ConfigFlowErrorKind);
}

// All synchronous except editConfig.
export function showConfig(deps: { cwd: string; ops: ConfigFlowOps }): string;
export function configPath(deps: { cwd: string; ops: ConfigFlowOps }): { path: string; exists: boolean };
export async function editConfig(deps: {
  cwd: string;
  ops: ConfigFlowOps;
  runner: Runner;
  env?: NodeJS.ProcessEnv; // for test injection
}): Promise<{ exitCode: number }>;
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit (helpers) | `findConfigPath` returns absolute path or null | `tmp-promise` real fs |
| Unit (flows) | `showConfig` round-trips merged YAML; `configPath` reports presence; `editConfig` resolves $VISUAL→$EDITOR, propagates exit, refuses missing config | `FakeRunner` for spawn assertions; inject `env` to simulate $VISUAL/$EDITOR variants |
| Integration | end-to-end via built `dist/index.js` | Run `peel config show/path/edit` against a real `.peel.yml`; for `edit`, set `EDITOR="node -e 'process.exit(0)'"` |

## Migration / Rollout

No migration. New subcommands; existing surface unchanged.

## Open Questions

None.
