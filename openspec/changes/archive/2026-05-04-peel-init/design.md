# Design: peel init

## Technical Approach

Ports & adapters with layered modules. The wizard is driven by a `Prompter` interface; the real implementation wraps `@clack/prompts`, the test implementation is a scripted `FakePrompter`. Config schema is the single source of truth (zod) — derived TS types, runtime validation, and JSON-Schema-like defaults all flow from it. Writing the file is split into "diff against defaults" + "serialize via `yaml.Document`" + "atomic write (temp + rename)" so each step is a one-purpose pure function.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Wizard testability | `Prompter` port + `FakePrompter` | Strict TDD requires sub-millisecond unit tests of branching; mocking clack at boundary is brittle |
| Config schema lib | `zod` | PRD pick; type inference; readable errors |
| YAML lib | `yaml` (eemeli) | Document API → deterministic output; round-trip safe |
| PM detection | Corepack > pnpm > bun > yarn > npm | First match wins; matches PRD §6.1 |
| Schema version | Constant in `config-schema.ts`; `version: 1` field on the schema; refused parse for unknown majors | Keeps version in one place; bumping is intentional |
| File write | `writeFile(tmp)` → `rename(tmp → final)` | POSIX atomic; survives mid-write crash per spec |
| CLI dispatch | `commander` subcommand registry in `src/index.ts` | PRD pick; small surface; built-in `--help` |
| Trailing newline | `\n` enforced in writer, not yaml | Single source of truth for the rule |
| Error mode | Custom `PeelInitError` with kind enum | Lets command handler print friendly messages without leaking stack traces |

## Data Flow (happy path)

```
                                                    ┌───── package.json ─┐
                                                    │  lockfiles (.env*) │
                                                    └────────┬───────────┘
                                                             │ read
            user                                             ▼
              ▲                                      ┌──────────────┐
              │ prompts                              │  detect.ts   │
              │                                      └──────┬───────┘
       ┌──────┴───────┐    ports        ┌──────────┐        │
       │  clack       │ ─────────────►  │ Prompter │ ──┐    │ DetectedDefaults
       │  Prompter    │                 │ (port)   │   │    │
       └──────────────┘                 └────┬─────┘   │    ▼
                                             │ inject  └─► ┌──────────────┐
                                             │             │ init-wizard  │
                                             └────────────►│   (logic)    │
                                                           └──────┬───────┘
                                                                  │ Answers
                                                                  ▼
                                                           ┌──────────────┐
                                                           │ config-write │
                                                           │  diff+yaml+  │
                                                           │  atomic write│
                                                           └──────┬───────┘
                                                                  ▼
                                                              .peel.yml
```

## File Changes

| File | Action | Notes |
|---|---|---|
| `src/index.ts` | Modify | Add commander; register `init` subcommand |
| `src/commands/init.ts` | Create | Wire prompter → wizard → writer; map errors |
| `src/core/config-schema.ts` | Create | zod schema + `Config` type + `SCHEMA_VERSION = 1` |
| `src/core/config-defaults.ts` | Create | `DEFAULT_CONFIG: Config` (parses against schema in tests) |
| `src/core/config-write.ts` | Create | `writeConfig(target: Config, path: string)` |
| `src/core/detect.ts` | Create | `detectPackageManager`, `detectEnvFiles`, `detectScripts` |
| `src/core/init-wizard.ts` | Create | `runWizard(deps: { prompter, detected })` |
| `src/ports/prompter.ts` | Create | `Prompter` interface + `CANCEL` sentinel |
| `src/ui/clack-prompter.ts` | Create | Adapter using `@clack/prompts` |
| `src/ui/banner.ts` | Create | `intro`, `outro`, `formatError` |
| `src/core/__fixtures__/fake-prompter.ts` | Create | Test fake with `script()` |
| `src/core/*.test.ts` | Create | One per module |
| `test/init.integration.test.ts` | Create | `spawnSync` against tmp repo |
| `package.json` | Modify | + `commander`, `@clack/prompts`, `zod`, `yaml` |

## Interfaces / Contracts

```ts
// src/ports/prompter.ts
export const CANCEL = Symbol("peel.cancel");
export type Cancel = typeof CANCEL;

export interface Prompter {
  intro(message: string): void;
  outro(message: string): void;
  text(opts: { message: string; placeholder?: string; defaultValue?: string }): Promise<string | Cancel>;
  select<T extends string>(opts: { message: string; options: { value: T; label: string }[]; initialValue?: T }): Promise<T | Cancel>;
  multiselect<T extends string>(opts: { message: string; options: { value: T; label: string }[]; initialValues?: T[]; required?: boolean }): Promise<T[] | Cancel>;
  confirm(opts: { message: string; initialValue?: boolean }): Promise<boolean | Cancel>;
}
export const isCancel = (v: unknown): v is Cancel => v === CANCEL;
```

```ts
// src/core/detect.ts (signatures)
export type DetectedDefaults = {
  packageManager: "npm" | "pnpm" | "yarn" | "bun";
  envFiles: string[];
  scripts: { dev: string | null; build: string | null; start: string | null };
};
export function detectPackageManager(cwd: string): DetectedDefaults["packageManager"];
export function detectEnvFiles(cwd: string): string[];
export function detectScripts(cwd: string): DetectedDefaults["scripts"];
```

```ts
// src/core/config-write.ts (algorithm)
// 1) pickNonDefault(answer, DEFAULT_CONFIG) → Partial<Config>  (recursive deep-equal)
// 2) yaml.stringify(partial, { lineWidth: 100, defaultStringType: "PLAIN" })
//    plus a single \n at end
// 3) writeFileSync(`${path}.${pid}.tmp`, body, { encoding: "utf8" })
//    renameSync(tmp, path)
```

Schema shape (kept compact in `config-schema.ts`):
- `version: 1`
- `port: { base: number; strategy: "fixed" | "auto-find" }`
- `envFiles: string[]`
- `packageManager: enum`
- `commands: { install, dev, build, start }: string`
- `preRun: string[]`
- `worktree: { baseDir: string; prefix: string; autoCleanup: boolean }`
- `git: { fetchOnStart: boolean; includeRemoteBranches: boolean; excludeBranches: string[] }`

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit — schema | Valid configs parse; bad configs throw `ZodError` | vitest, in-memory |
| Unit — defaults | `DEFAULT_CONFIG` parses against schema | vitest |
| Unit — detect | PM precedence; env exclusions; missing/broken `package.json` | tmp-promise; real `fs` writes; **no mocks** |
| Unit — writer | Round-trip; minimal output equals fixture; deterministic; atomic temp file | tmp-promise; assert exact bytes |
| Unit — wizard | Happy path, cancel branches, existing-config branch | `FakePrompter` scripted answers |
| Integration | `spawnSync(node, ['dist/index.js','init','--yes'])` in tmp git repo | Same pattern as `test/smoke.integration.test.ts` |

Strict TDD: every behavior task ships with a RED test (fails first) → GREEN (passing implementation) → REFACTOR. Apply-progress will record evidence per task.

## Migration / Rollout

No migration. New files only. After merge, the binary on npm (`@tanisjam/peel@0.0.1`) still works as a placeholder until a real release is cut (separate change). No CLI flag changes for users yet because there is no prior CLI surface.

## Open Questions

None. All decisions in the table above are firm.
