import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { execa } from "execa";

export type Worktree = {
  path: string;
  branch: string | null;
  head: string;
};

export type WorktreeErrorKind = "path-exists" | "branch-already-checked-out" | "git-error";

export class WorktreeError extends Error {
  constructor(
    message: string,
    public readonly kind: WorktreeErrorKind,
  ) {
    super(message);
    this.name = "WorktreeError";
  }
}

const SAFE_CHARS = /[^A-Za-z0-9_.-]+/g;

export function slugify(branch: string): string {
  return branch.replace(SAFE_CHARS, "-").replace(/-+/g, "-");
}

export type WorktreePathArgs = {
  repoRoot: string;
  baseDir: string;
  repoName: string;
  branch: string;
};

export function worktreePath(args: WorktreePathArgs): string {
  const base = resolve(args.repoRoot, args.baseDir);
  return resolve(base, `${args.repoName}-${slugify(args.branch)}`);
}

function isNonEmptyDir(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    return readdirSync(path).length > 0;
  } catch {
    return false;
  }
}

async function localBranchExists(repoRoot: string, branch: string): Promise<boolean> {
  const result = await execa("git", ["show-ref", "--verify", `refs/heads/${branch}`], {
    cwd: repoRoot,
    reject: false,
  });
  return result.exitCode === 0;
}

async function remoteBranchExists(repoRoot: string, branch: string): Promise<boolean> {
  const result = await execa("git", ["show-ref", "--verify", `refs/remotes/origin/${branch}`], {
    cwd: repoRoot,
    reject: false,
  });
  return result.exitCode === 0;
}

export type CreateWorktreeArgs = {
  repoRoot: string;
  path: string;
  branch: string;
};

export async function createWorktree(args: CreateWorktreeArgs): Promise<void> {
  if (isNonEmptyDir(args.path)) {
    throw new WorktreeError(
      `Worktree path already exists and is not empty: ${args.path}`,
      "path-exists",
    );
  }

  const hasLocal = await localBranchExists(args.repoRoot, args.branch);
  let cmd: string[];
  if (hasLocal) {
    cmd = ["worktree", "add", args.path, args.branch];
  } else if (await remoteBranchExists(args.repoRoot, args.branch)) {
    cmd = ["worktree", "add", "--track", "-b", args.branch, args.path, `origin/${args.branch}`];
  } else {
    throw new WorktreeError(`Branch '${args.branch}' not found locally or on origin`, "git-error");
  }

  const result = await execa("git", cmd, { cwd: args.repoRoot, reject: false });
  if (result.exitCode !== 0) {
    const stderr = String(result.stderr ?? "");
    if (/already used by worktree|already checked out/i.test(stderr)) {
      throw new WorktreeError(stderr.trim(), "branch-already-checked-out");
    }
    throw new WorktreeError(`git ${cmd.join(" ")} failed: ${stderr.trim()}`, "git-error");
  }
}

export async function listWorktrees(repoRoot: string): Promise<Worktree[]> {
  const { stdout } = await execa("git", ["worktree", "list", "--porcelain"], {
    cwd: repoRoot,
  });

  const result: Worktree[] = [];
  let cur: { path?: string; branch?: string | null; head?: string } = {};

  const flush = () => {
    if (cur.path && cur.head !== undefined) {
      result.push({
        path: cur.path,
        branch: cur.branch ?? null,
        head: cur.head,
      });
    }
    cur = {};
  };

  for (const line of String(stdout).split("\n")) {
    if (line === "") {
      flush();
      continue;
    }
    if (line.startsWith("worktree ")) {
      flush();
      cur.path = line.slice("worktree ".length);
    } else if (line.startsWith("HEAD ")) {
      cur.head = line.slice("HEAD ".length);
    } else if (line.startsWith("branch ")) {
      const ref = line.slice("branch ".length);
      cur.branch = ref.replace(/^refs\/heads\//, "");
    } else if (line === "detached") {
      cur.branch = null;
    }
  }
  flush();
  return result;
}

export async function removeWorktree(repoRoot: string, path: string): Promise<{ ok: true }> {
  if (!existsSync(path)) {
    // Try to prune the gitdir entry without complaining; otherwise no-op.
    await execa("git", ["worktree", "prune"], { cwd: repoRoot, reject: false });
    return { ok: true };
  }

  const result = await execa("git", ["worktree", "remove", "--force", path], {
    cwd: repoRoot,
    reject: false,
  });
  if (result.exitCode !== 0) {
    // Best-effort fallback: try prune; if the dir really exists git should at
    // least delete its registration.
    await execa("git", ["worktree", "prune"], { cwd: repoRoot, reject: false });
  }
  return { ok: true };
}
