import {
  type CleanFlowDeps,
  CleanFlowError,
  type CleanMode,
  cleanFlow,
} from "../core/clean-flow.js";
import { loadConfig } from "../core/config-load.js";
import { findGitRoot, getRepoName, gitFetch, listBranches } from "../core/git.js";
import { listWorktrees, removeWorktree } from "../core/worktree.js";
import type { Prompter } from "../ports/prompter.js";
import { formatCleanSummary, formatError, formatRunningWarning } from "../ui/banner.js";

export type RunCleanCommandArgs = {
  cwd: string;
  prompter: Prompter;
  mode: CleanMode;
  branch?: string;
  yes: boolean;
  noFetch: boolean;
  logger?: { info?: (m: string) => void; warn?: (m: string) => void };
};

export type RunCleanCommandResult = { exitCode: number; message?: string };

export async function runCleanCommand(args: RunCleanCommandArgs): Promise<RunCleanCommandResult> {
  const deps: CleanFlowDeps = {
    cwd: args.cwd,
    args: {
      mode: args.mode,
      ...(args.branch !== undefined ? { branch: args.branch } : {}),
      yes: args.yes,
      noFetch: args.noFetch,
    },
    prompter: args.prompter,
    ops: {
      loadConfig,
      findGitRoot,
      getRepoName,
      listWorktrees,
      listBranches,
      gitFetch,
      removeWorktree,
    },
    ...(args.logger ? { logger: args.logger } : {}),
  };

  try {
    const result = await cleanFlow(deps);
    const lines: string[] = [];
    if (result.runningWarning && args.branch) {
      lines.push(formatRunningWarning(args.branch));
    }
    lines.push(
      formatCleanSummary({
        ...(result.cancelled ? { cancelled: true } : {}),
        outcomes: result.outcomes,
      }),
    );
    return { exitCode: 0, message: lines.join("\n") };
  } catch (err) {
    if (err instanceof CleanFlowError) {
      return { exitCode: 1, message: formatCleanFlowError(err) };
    }
    return { exitCode: 1, message: formatError(err) };
  }
}

export function formatCleanFlowError(err: CleanFlowError): string {
  return err.message;
}
