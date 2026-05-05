import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dir } from "tmp-promise";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config-defaults.js";
import type { Config } from "./config-schema.js";
import { type ListFlowDeps, ListFlowError, listFlow } from "./list-flow.js";
import type { Worktree } from "./worktree.js";

type Cleanup = () => Promise<void>;
const cleanups: Cleanup[] = [];
afterEach(async () => {
  while (cleanups.length) {
    const fn = cleanups.pop();
    if (fn) await fn();
  }
});

async function tmpRepoWithWorktrees(): Promise<{
  repoRoot: string;
  worktreeBase: string;
  toolPaths: { x: string; y: string };
}> {
  const repoDir = await dir({ unsafeCleanup: true });
  cleanups.push(repoDir.cleanup);
  // baseDir ".." would resolve to the parent of repoRoot — but for the test
  // we just place the worktree dirs as siblings to repoRoot.
  const parent = repoDir.path.replace(/\/[^/]+$/, "");
  const repoName = "widget";
  // Re-root: create a controlled parent dir.
  const ctl = await dir({ unsafeCleanup: true });
  cleanups.push(ctl.cleanup);
  const repoRoot = join(ctl.path, repoName);
  mkdirSync(repoRoot, { recursive: true });
  const x = join(ctl.path, "widget-feature-x");
  const y = join(ctl.path, "widget-feature-y");
  mkdirSync(x);
  mkdirSync(y);
  return { repoRoot, worktreeBase: parent, toolPaths: { x, y } };
}

function baseConfig(): Config {
  return { ...DEFAULT_CONFIG };
}

function makeOps(opts: {
  config: Config | null;
  repoRoot: string;
  worktrees: Worktree[];
}): ListFlowDeps["ops"] {
  return {
    loadConfig: () => opts.config,
    findGitRoot: () => opts.repoRoot,
    getRepoName: () => "widget",
    listWorktrees: async () => opts.worktrees,
  };
}

describe("listFlow", () => {
  it("returns rows for tool-created worktrees and excludes the main repo", async () => {
    const fx = await tmpRepoWithWorktrees();
    const main: Worktree = { path: fx.repoRoot, branch: "main", head: "abc" };
    const x: Worktree = { path: fx.toolPaths.x, branch: "feature/x", head: "def" };
    const y: Worktree = { path: fx.toolPaths.y, branch: "feature/y", head: "ghi" };
    const result = await listFlow({
      cwd: fx.repoRoot,
      ops: makeOps({ config: baseConfig(), repoRoot: fx.repoRoot, worktrees: [main, x, y] }),
    });
    expect(result.rows.map((r) => r.branch).sort()).toEqual(["feature/x", "feature/y"]);
    expect(result.rows.find((r) => r.path === fx.repoRoot)).toBeUndefined();
  });

  it("returns empty rows when no tool-created worktrees exist", async () => {
    const fx = await tmpRepoWithWorktrees();
    const main: Worktree = { path: fx.repoRoot, branch: "main", head: "abc" };
    const result = await listFlow({
      cwd: fx.repoRoot,
      ops: makeOps({ config: baseConfig(), repoRoot: fx.repoRoot, worktrees: [main] }),
    });
    expect(result.rows).toEqual([]);
  });

  it("throws ListFlowError(no-config) when no .peel.yml found", async () => {
    const fx = await tmpRepoWithWorktrees();
    await expect(
      listFlow({
        cwd: fx.repoRoot,
        ops: makeOps({ config: null, repoRoot: fx.repoRoot, worktrees: [] }),
      }),
    ).rejects.toMatchObject({
      name: "ListFlowError",
      kind: "no-config",
    });
  });

  it("throws ListFlowError(no-config) when not in a git repo", async () => {
    const fx = await tmpRepoWithWorktrees();
    const ops = makeOps({ config: baseConfig(), repoRoot: fx.repoRoot, worktrees: [] });
    ops.findGitRoot = () => null;
    await expect(listFlow({ cwd: fx.repoRoot, ops })).rejects.toBeInstanceOf(ListFlowError);
  });

  it("populates status and ageMs per row", async () => {
    const fx = await tmpRepoWithWorktrees();
    // Mark x as running by writing peel.lock with current PID
    writeFileSync(join(fx.toolPaths.x, "peel.lock"), String(process.pid), "utf8");
    const main: Worktree = { path: fx.repoRoot, branch: "main", head: "abc" };
    const x: Worktree = { path: fx.toolPaths.x, branch: "feature/x", head: "def" };
    const y: Worktree = { path: fx.toolPaths.y, branch: "feature/y", head: "ghi" };
    const result = await listFlow({
      cwd: fx.repoRoot,
      ops: makeOps({ config: baseConfig(), repoRoot: fx.repoRoot, worktrees: [main, x, y] }),
    });
    const xRow = result.rows.find((r) => r.branch === "feature/x");
    const yRow = result.rows.find((r) => r.branch === "feature/y");
    expect(xRow?.status).toBe("running");
    expect(yRow?.status).toBe("idle");
    expect(typeof xRow?.ageMs).toBe("number");
    expect(xRow?.ageMs).toBeGreaterThanOrEqual(0);
  });
});
