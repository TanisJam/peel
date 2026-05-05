import { join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import type { Runner } from "../ports/runner.js";
import type { Config } from "./config-schema.js";

export type ConfigFlowOps = {
  loadConfig: (cwd: string) => Config | null;
  findGitRoot: (cwd: string) => string | null;
  findConfigPath: (cwd: string) => string | null;
};

export type ConfigFlowErrorKind = "no-config" | "no-git" | "no-editor";

export class ConfigFlowError extends Error {
  constructor(
    message: string,
    public readonly kind: ConfigFlowErrorKind,
  ) {
    super(message);
    this.name = "ConfigFlowError";
  }
}

const YAML_OPTS = {
  lineWidth: 100,
  indent: 2,
  defaultStringType: "PLAIN" as const,
  defaultKeyType: "PLAIN" as const,
};

export type ShowConfigDeps = { cwd: string; ops: ConfigFlowOps };

export function showConfig(deps: ShowConfigDeps): string {
  const config = deps.ops.loadConfig(deps.cwd);
  if (!config) {
    throw new ConfigFlowError("No .peel.yml found. Run `peel init` first.", "no-config");
  }
  const body = yamlStringify(config as unknown as Record<string, unknown>, YAML_OPTS);
  return body.endsWith("\n") ? body : `${body}\n`;
}

export type ConfigPathDeps = { cwd: string; ops: ConfigFlowOps };
export type ConfigPathResult = { path: string; exists: boolean };

export function configPath(deps: ConfigPathDeps): ConfigPathResult {
  const found = deps.ops.findConfigPath(deps.cwd);
  if (found) return { path: found, exists: true };
  const root = deps.ops.findGitRoot(deps.cwd);
  if (!root) {
    throw new ConfigFlowError(
      "Not in a git repository. Run `peel init` first or move into a git repo.",
      "no-git",
    );
  }
  return { path: join(root, ".peel.yml"), exists: false };
}

export type EditConfigDeps = {
  cwd: string;
  ops: ConfigFlowOps;
  runner: Runner;
  env?: NodeJS.ProcessEnv;
};

export type EditConfigResult = { exitCode: number };

function resolveEditor(env: NodeJS.ProcessEnv): string | null {
  const v = env.VISUAL?.trim();
  if (v) return v;
  const e = env.EDITOR?.trim();
  if (e) return e;
  return null;
}

export async function editConfig(deps: EditConfigDeps): Promise<EditConfigResult> {
  const env = deps.env ?? process.env;
  const found = deps.ops.findConfigPath(deps.cwd);
  if (!found) {
    throw new ConfigFlowError("No .peel.yml found. Run `peel init` first.", "no-config");
  }
  const editor = resolveEditor(env);
  if (!editor) {
    throw new ConfigFlowError(
      "No editor configured. Set $VISUAL or $EDITOR (e.g. `export EDITOR=vi`).",
      "no-editor",
    );
  }
  const handle = deps.runner.spawn({
    command: `${editor} "${found}"`,
    cwd: deps.cwd,
  });
  const exit = await handle.exited;
  return { exitCode: exit.exitCode ?? 0 };
}
