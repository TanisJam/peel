import type { Config } from "./config-schema.js";
import {
  type WorktreeStatus,
  filterToolWorktrees,
  getWorktreeAge,
  getWorktreeStatus,
} from "./worktree-filter.js";
import type { Worktree } from "./worktree.js";

export type ListFlowOps = {
  loadConfig: (cwd: string) => Config | null;
  findGitRoot: (cwd: string) => string | null;
  getRepoName: (repoRoot: string) => string;
  listWorktrees: (repoRoot: string) => Promise<Worktree[]>;
};

export type ListFlowDeps = {
  cwd: string;
  ops: ListFlowOps;
};

export type ListRow = {
  branch: string;
  path: string;
  ageMs: number;
  status: WorktreeStatus;
};

export type ListFlowResult = { rows: ListRow[] };

export type ListFlowErrorKind = "no-config";

export class ListFlowError extends Error {
  constructor(
    message: string,
    public readonly kind: ListFlowErrorKind,
  ) {
    super(message);
    this.name = "ListFlowError";
  }
}

export async function listFlow(deps: ListFlowDeps): Promise<ListFlowResult> {
  const { cwd, ops } = deps;

  const repoRoot = ops.findGitRoot(cwd);
  if (!repoRoot) {
    throw new ListFlowError("Not in a git repository. Run `peel init` first.", "no-config");
  }
  const config = ops.loadConfig(cwd);
  if (!config) {
    throw new ListFlowError("No .peel.yml found. Run `peel init` first.", "no-config");
  }

  const repoName = ops.getRepoName(repoRoot);
  const all = await ops.listWorktrees(repoRoot);
  const tool = filterToolWorktrees(all, {
    repoRoot,
    baseDir: config.worktree.baseDir,
    repoName,
  });

  const rows: ListRow[] = tool.map((wt) => ({
    branch: wt.branch ?? "",
    path: wt.path,
    ageMs: getWorktreeAge(wt.path),
    status: getWorktreeStatus(wt.path),
  }));

  return { rows };
}
