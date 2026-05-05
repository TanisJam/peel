import {
  ConfigFlowError,
  type ConfigFlowOps,
  configPath,
  editConfig,
  showConfig,
} from "../core/config-flow.js";
import { findConfigPath, loadConfig } from "../core/config-load.js";
import { findGitRoot } from "../core/git.js";
import type { Runner } from "../ports/runner.js";
import { formatError } from "../ui/banner.js";

const realOps: ConfigFlowOps = {
  loadConfig,
  findGitRoot,
  findConfigPath,
};

export type RunConfigShowArgs = { cwd: string };
export type RunConfigCommandResult = { exitCode: number; message?: string };

export async function runConfigShow(args: RunConfigShowArgs): Promise<RunConfigCommandResult> {
  try {
    const yaml = showConfig({ cwd: args.cwd, ops: realOps });
    return { exitCode: 0, message: yaml.replace(/\n$/, "") };
  } catch (err) {
    if (err instanceof ConfigFlowError) {
      return { exitCode: 1, message: formatConfigFlowError(err) };
    }
    return { exitCode: 1, message: formatError(err) };
  }
}

export type RunConfigPathArgs = { cwd: string };

export async function runConfigPath(args: RunConfigPathArgs): Promise<RunConfigCommandResult> {
  try {
    const result = configPath({ cwd: args.cwd, ops: realOps });
    return { exitCode: result.exists ? 0 : 1, message: result.path };
  } catch (err) {
    if (err instanceof ConfigFlowError) {
      return { exitCode: 1, message: formatConfigFlowError(err) };
    }
    return { exitCode: 1, message: formatError(err) };
  }
}

export type RunConfigEditArgs = {
  cwd: string;
  runner: Runner;
  env?: NodeJS.ProcessEnv;
};

export async function runConfigEdit(args: RunConfigEditArgs): Promise<RunConfigCommandResult> {
  try {
    const result = await editConfig({
      cwd: args.cwd,
      ops: realOps,
      runner: args.runner,
      ...(args.env !== undefined ? { env: args.env } : {}),
    });
    return { exitCode: result.exitCode };
  } catch (err) {
    if (err instanceof ConfigFlowError) {
      return { exitCode: 1, message: formatConfigFlowError(err) };
    }
    return { exitCode: 1, message: formatError(err) };
  }
}

export function formatConfigFlowError(err: ConfigFlowError): string {
  return err.message;
}
