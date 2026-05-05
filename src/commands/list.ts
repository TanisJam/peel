import { loadConfig } from "../core/config-load.js";
import { findGitRoot, getRepoName } from "../core/git.js";
import { type ListFlowDeps, ListFlowError, listFlow } from "../core/list-flow.js";
import { listWorktrees } from "../core/worktree.js";
import { formatError, formatNoWorktrees, formatWorktreeTable } from "../ui/banner.js";

export type RunListCommandArgs = { cwd: string };

export type RunListCommandResult = { exitCode: number; message?: string };

export async function runListCommand(args: RunListCommandArgs): Promise<RunListCommandResult> {
  const deps: ListFlowDeps = {
    cwd: args.cwd,
    ops: {
      loadConfig,
      findGitRoot,
      getRepoName,
      listWorktrees,
    },
  };
  try {
    const result = await listFlow(deps);
    if (result.rows.length === 0) {
      return { exitCode: 0, message: formatNoWorktrees() };
    }
    return { exitCode: 0, message: formatWorktreeTable(result.rows) };
  } catch (err) {
    if (err instanceof ListFlowError) {
      return { exitCode: 1, message: formatListFlowError(err) };
    }
    return { exitCode: 1, message: formatError(err) };
  }
}

export function formatListFlowError(err: ListFlowError): string {
  return err.message;
}
