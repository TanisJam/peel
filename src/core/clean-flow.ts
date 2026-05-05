import type { Prompter } from "../ports/prompter.js";
import { isCancel } from "../ports/prompter.js";
import type { Config } from "./config-schema.js";
import type { Branch, FetchResult } from "./git.js";
import { filterToolWorktrees, getWorktreeStatus } from "./worktree-filter.js";
import type { Worktree } from "./worktree.js";

export type CleanMode = "single" | "all" | "stale";

export type CleanFlowArgs = {
  mode: CleanMode;
  branch?: string;
  yes: boolean;
  noFetch: boolean;
};

export type CleanFlowOps = {
  loadConfig: (cwd: string) => Config | null;
  findGitRoot: (cwd: string) => string | null;
  getRepoName: (repoRoot: string) => string;
  listWorktrees: (repoRoot: string) => Promise<Worktree[]>;
  listBranches: (repoRoot: string) => Promise<Branch[]>;
  gitFetch: (repoRoot: string) => Promise<FetchResult>;
  removeWorktree: (repoRoot: string, path: string) => Promise<{ ok: true }>;
};

export type CleanFlowDeps = {
  cwd: string;
  args: CleanFlowArgs;
  prompter: Prompter;
  ops: CleanFlowOps;
  logger?: { info?: (m: string) => void; warn?: (m: string) => void };
};

export type CleanFlowOutcome =
  | { kind: "removed"; branch: string }
  | { kind: "skipped-running"; branch: string };

export type CleanFlowResult = {
  cancelled?: boolean;
  runningWarning?: boolean;
  outcomes: CleanFlowOutcome[];
};

export type CleanFlowErrorKind = "no-config" | "branch-not-found";

export class CleanFlowError extends Error {
  constructor(
    message: string,
    public readonly kind: CleanFlowErrorKind,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "CleanFlowError";
  }
}

async function removeMany(
  ops: CleanFlowOps,
  repoRoot: string,
  targets: Worktree[],
): Promise<CleanFlowOutcome[]> {
  const outcomes: CleanFlowOutcome[] = [];
  for (const wt of targets) {
    await ops.removeWorktree(repoRoot, wt.path);
    outcomes.push({ kind: "removed", branch: wt.branch ?? "" });
  }
  return outcomes;
}

function partitionByStatus(targets: Worktree[]): {
  idle: Worktree[];
  running: Worktree[];
} {
  const idle: Worktree[] = [];
  const running: Worktree[] = [];
  for (const wt of targets) {
    if (getWorktreeStatus(wt.path) === "running") running.push(wt);
    else idle.push(wt);
  }
  return { idle, running };
}

export async function cleanFlow(deps: CleanFlowDeps): Promise<CleanFlowResult> {
  const { cwd, args, prompter, ops, logger } = deps;

  const repoRoot = ops.findGitRoot(cwd);
  if (!repoRoot) {
    throw new CleanFlowError("Not in a git repository. Run `peel init` first.", "no-config");
  }
  const config = ops.loadConfig(cwd);
  if (!config) {
    throw new CleanFlowError("No .peel.yml found. Run `peel init` first.", "no-config");
  }
  const repoName = ops.getRepoName(repoRoot);

  const all = await ops.listWorktrees(repoRoot);
  const tool = filterToolWorktrees(all, {
    repoRoot,
    baseDir: config.worktree.baseDir,
    repoName,
  });

  if (args.mode === "single") {
    const target = tool.find((wt) => wt.branch === args.branch);
    if (!target) {
      throw new CleanFlowError(
        `Branch '${args.branch}' is not a peel-managed worktree`,
        "branch-not-found",
        { name: args.branch },
      );
    }
    const isRunning = getWorktreeStatus(target.path) === "running";
    if (isRunning) {
      logger?.warn?.(
        `Worktree for '${target.branch}' appears to be running — proceeding with single-target removal.`,
      );
    }
    await ops.removeWorktree(repoRoot, target.path);
    return {
      ...(isRunning ? { runningWarning: true } : {}),
      outcomes: [{ kind: "removed", branch: target.branch ?? "" }],
    };
  }

  // bulk: --all or --stale
  let candidates: Worktree[];
  if (args.mode === "stale") {
    if (!args.noFetch && config.git.fetchOnStart) {
      const result = await ops.gitFetch(repoRoot);
      if (!result.ok) {
        logger?.warn?.(
          `git fetch failed: ${result.error} — staleness computed from local view only`,
        );
      }
    }
    const branches = await ops.listBranches(repoRoot);
    const known = new Set(branches.map((b) => b.name));
    candidates = tool.filter((wt) => wt.branch !== null && !known.has(wt.branch));
  } else {
    // mode === "all"
    candidates = tool;
  }

  if (candidates.length === 0) {
    return { outcomes: [] };
  }

  if (!args.yes) {
    const label =
      args.mode === "stale"
        ? `Remove ${candidates.length} stale worktree(s)?`
        : `Remove ${candidates.length} worktree(s)?`;
    const confirmed = await prompter.confirm({ message: label, initialValue: false });
    if (isCancel(confirmed) || confirmed === false) {
      return { cancelled: true, outcomes: [] };
    }
  }

  const { idle, running } = partitionByStatus(candidates);
  const removed = await removeMany(ops, repoRoot, idle);
  const skipped: CleanFlowOutcome[] = running.map((wt) => ({
    kind: "skipped-running" as const,
    branch: wt.branch ?? "",
  }));
  return { outcomes: [...removed, ...skipped] };
}
