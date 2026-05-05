import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import type { Worktree } from "./worktree.js";
import { slugify } from "./worktree.js";

export type WorktreeStatus = "running" | "idle" | "unknown";

export type FilterContext = {
  repoRoot: string;
  baseDir: string;
  repoName: string;
};

const LOCK_FILE = "peel.lock";

export function filterToolWorktrees(all: Worktree[], ctx: FilterContext): Worktree[] {
  const expectedParent = resolve(ctx.repoRoot, ctx.baseDir);
  return all.filter((wt) => {
    if (wt.branch === null) return false;
    if (resolve(wt.path) === resolve(ctx.repoRoot)) return false;
    if (resolve(dirname(wt.path)) !== expectedParent) return false;
    const expectedBasename = `${ctx.repoName}-${slugify(wt.branch)}`;
    return basename(wt.path) === expectedBasename;
  });
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EPERM") return true;
    return false;
  }
}

export function getWorktreeStatus(path: string): WorktreeStatus {
  const lockPath = resolve(path, LOCK_FILE);
  if (!existsSync(lockPath)) return "idle";
  let raw: string;
  try {
    raw = readFileSync(lockPath, "utf8").trim();
  } catch {
    return "unknown";
  }
  const pid = Number.parseInt(raw, 10);
  if (!Number.isFinite(pid)) return "idle";
  return isProcessAlive(pid) ? "running" : "idle";
}

export function getWorktreeAge(path: string): number {
  try {
    const st = statSync(path);
    return Math.max(0, Date.now() - st.mtimeMs);
  } catch {
    return 0;
  }
}

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function formatAge(ms: number): string {
  if (ms >= DAY) return `${Math.floor(ms / DAY)}d`;
  if (ms >= HOUR) return `${Math.floor(ms / HOUR)}h`;
  if (ms >= MIN) return `${Math.floor(ms / MIN)}m`;
  return `${Math.floor(ms / SEC)}s`;
}
