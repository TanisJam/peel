import type { Logger } from "../core/cleanup.js";
import { loadConfig } from "../core/config-load.js";
import { currentBranch, findGitRoot, getRepoName, gitFetch, listBranches } from "../core/git.js";
import { findFreePort, isPortBusy, whoHoldsPort } from "../core/port.js";
import { type RunFlowDeps, RunFlowError, runFlow } from "../core/run-flow.js";
import { createWorktree, listWorktrees, removeWorktree, worktreePath } from "../core/worktree.js";
import type { Prompter } from "../ports/prompter.js";
import type { Runner } from "../ports/runner.js";
import {
  formatBranchNotFound,
  formatError,
  formatInstallFailure,
  formatPortBusy,
} from "../ui/banner.js";

export type RunCommandArgs = {
  cwd: string;
  prompter: Prompter;
  runner: Runner;
  logger?: Logger;
  branch?: string;
  mode?: "dev" | "build";
  port?: number;
  keep: boolean;
  noFetch: boolean;
  yes: boolean;
};

export type RunCommandResult = { exitCode: number; message?: string };

export async function runCommand(args: RunCommandArgs): Promise<RunCommandResult> {
  // unused-suppress for currentBranch (not directly invoked in this flow yet)
  void currentBranch;

  const deps: RunFlowDeps = {
    cwd: args.cwd,
    args: {
      ...(args.branch !== undefined ? { branch: args.branch } : {}),
      ...(args.mode !== undefined ? { mode: args.mode } : {}),
      ...(args.port !== undefined ? { port: args.port } : {}),
      keep: args.keep,
      noFetch: args.noFetch,
      yes: args.yes,
    },
    prompter: args.prompter,
    runner: args.runner,
    ops: {
      loadConfig,
      findGitRoot,
      getRepoName,
      gitFetch,
      listBranches,
      isPortBusy,
      findFreePort,
      whoHoldsPort,
      createWorktree,
      removeWorktree,
      listWorktrees,
      worktreePath,
    },
    ...(args.logger ? { logger: args.logger } : {}),
  };

  try {
    const result = await runFlow(deps);
    return { exitCode: result.exitCode };
  } catch (err) {
    if (err instanceof RunFlowError) {
      return { exitCode: 1, message: formatRunFlowError(err) };
    }
    return { exitCode: 1, message: formatError(err) };
  }
}

export function formatRunFlowError(err: RunFlowError): string {
  switch (err.kind) {
    case "no-config":
      return err.message;
    case "branch-not-found": {
      const detail = err.detail as { name: string; suggestions: string[] };
      return formatBranchNotFound({
        name: detail.name,
        suggestions: detail.suggestions,
      });
    }
    case "port-busy": {
      const detail = err.detail as {
        port: number;
        holder: { pid: number; command: string } | null;
      };
      return formatPortBusy({
        port: detail.port,
        ...(detail.holder ? { holder: detail.holder } : {}),
      });
    }
    case "install-failed": {
      const detail = err.detail as { log: string; logPath: string };
      return formatInstallFailure({
        log: detail.log,
        logPath: detail.logPath,
      });
    }
    case "hook-failed": {
      const detail = err.detail as {
        failedAt: number;
        command: string;
        exitCode: number;
      };
      return `Pre-run hook #${detail.failedAt + 1} failed (exit ${detail.exitCode}):\n  ${detail.command}`;
    }
    case "locked": {
      const detail = err.detail as { pid: number; worktreePath: string };
      return `Another peel run is in progress (PID ${detail.pid}) at ${detail.worktreePath}.\n  Wait for it to finish or remove ${detail.worktreePath}/peel.lock manually.`;
    }
    case "cancelled":
      return err.message;
  }
}
