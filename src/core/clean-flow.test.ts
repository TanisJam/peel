import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dir } from "tmp-promise";
import { afterEach, describe, expect, it } from "vitest";
import { FakePrompter } from "./__fixtures__/fake-prompter.js";
import { type CleanFlowDeps, CleanFlowError, type CleanFlowOps, cleanFlow } from "./clean-flow.js";
import { DEFAULT_CONFIG } from "./config-defaults.js";
import type { Config } from "./config-schema.js";
import type { Branch, FetchResult } from "./git.js";
import type { Worktree } from "./worktree.js";

type Cleanup = () => Promise<void>;
const cleanups: Cleanup[] = [];
afterEach(async () => {
  while (cleanups.length) {
    const fn = cleanups.pop();
    if (fn) await fn();
  }
});

const repoName = "widget";

async function setupFixture(branchPaths: string[]): Promise<{
  repoRoot: string;
  paths: Record<string, string>;
}> {
  const ctl = await dir({ unsafeCleanup: true });
  cleanups.push(ctl.cleanup);
  const repoRoot = join(ctl.path, repoName);
  mkdirSync(repoRoot, { recursive: true });
  const paths: Record<string, string> = {};
  for (const branch of branchPaths) {
    const slug = branch.replace(/\//g, "-");
    const p = join(ctl.path, `${repoName}-${slug}`);
    mkdirSync(p);
    paths[branch] = p;
  }
  return { repoRoot, paths };
}

function makeOps(opts: {
  config: Config | null;
  repoRoot: string;
  worktrees: Worktree[];
  branches?: Branch[];
  fetchResult?: FetchResult;
}): CleanFlowOps & {
  removeCalls: { repoRoot: string; path: string }[];
  fetchCalls: number;
} {
  const removeCalls: { repoRoot: string; path: string }[] = [];
  let fetchCalls = 0;
  return {
    loadConfig: () => opts.config,
    findGitRoot: () => opts.repoRoot,
    getRepoName: () => repoName,
    listWorktrees: async () => opts.worktrees,
    listBranches: async () => opts.branches ?? [],
    gitFetch: async () => {
      fetchCalls++;
      return opts.fetchResult ?? { ok: true as const };
    },
    removeWorktree: async (repoRoot: string, path: string) => {
      removeCalls.push({ repoRoot, path });
      return { ok: true as const };
    },
    removeCalls,
    get fetchCalls() {
      return fetchCalls;
    },
  };
}

function baseConfig(overrides: Partial<Config> = {}): Config {
  return { ...DEFAULT_CONFIG, ...overrides };
}

const wt = (path: string, branch: string): Worktree => ({ path, branch, head: "abc" });

describe("cleanFlow — single", () => {
  it("removes the matching tool worktree", async () => {
    const fx = await setupFixture(["feature/x"]);
    const ops = makeOps({
      config: baseConfig(),
      repoRoot: fx.repoRoot,
      worktrees: [wt(fx.repoRoot, "main"), wt(fx.paths["feature/x"] as string, "feature/x")],
    });
    const deps: CleanFlowDeps = {
      cwd: fx.repoRoot,
      args: { mode: "single", branch: "feature/x", yes: false, noFetch: false },
      prompter: new FakePrompter(),
      ops,
    };
    const result = await cleanFlow(deps);
    expect(result.outcomes).toEqual([{ kind: "removed", branch: "feature/x" }]);
    expect(ops.removeCalls).toEqual([{ repoRoot: fx.repoRoot, path: fx.paths["feature/x"] }]);
  });

  it("throws CleanFlowError(branch-not-found) when branch is not a tool worktree", async () => {
    const fx = await setupFixture([]);
    const ops = makeOps({
      config: baseConfig(),
      repoRoot: fx.repoRoot,
      worktrees: [wt(fx.repoRoot, "main")],
    });
    const deps: CleanFlowDeps = {
      cwd: fx.repoRoot,
      args: { mode: "single", branch: "nope", yes: false, noFetch: false },
      prompter: new FakePrompter(),
      ops,
    };
    await expect(cleanFlow(deps)).rejects.toMatchObject({
      name: "CleanFlowError",
      kind: "branch-not-found",
    });
  });

  it("removes a single-target running worktree but flags runningWarning", async () => {
    const fx = await setupFixture(["feature/x"]);
    writeFileSync(join(fx.paths["feature/x"] as string, "peel.lock"), String(process.pid), "utf8");
    const ops = makeOps({
      config: baseConfig(),
      repoRoot: fx.repoRoot,
      worktrees: [wt(fx.repoRoot, "main"), wt(fx.paths["feature/x"] as string, "feature/x")],
    });
    const deps: CleanFlowDeps = {
      cwd: fx.repoRoot,
      args: { mode: "single", branch: "feature/x", yes: true, noFetch: false },
      prompter: new FakePrompter(),
      ops,
    };
    const result = await cleanFlow(deps);
    expect(result.runningWarning).toBe(true);
    expect(result.outcomes).toEqual([{ kind: "removed", branch: "feature/x" }]);
  });
});

describe("cleanFlow — bulk (--all)", () => {
  it("removes all idle tool worktrees with --yes", async () => {
    const fx = await setupFixture(["feature/x", "feature/y", "feature/z"]);
    const ops = makeOps({
      config: baseConfig(),
      repoRoot: fx.repoRoot,
      worktrees: [
        wt(fx.repoRoot, "main"),
        wt(fx.paths["feature/x"] as string, "feature/x"),
        wt(fx.paths["feature/y"] as string, "feature/y"),
        wt(fx.paths["feature/z"] as string, "feature/z"),
      ],
    });
    const deps: CleanFlowDeps = {
      cwd: fx.repoRoot,
      args: { mode: "all", yes: true, noFetch: false },
      prompter: new FakePrompter(),
      ops,
    };
    const result = await cleanFlow(deps);
    expect(result.outcomes.filter((o) => o.kind === "removed")).toHaveLength(3);
    expect(ops.removeCalls).toHaveLength(3);
  });

  it("prompts for confirmation when --yes is false; accept removes all", async () => {
    const fx = await setupFixture(["feature/x", "feature/y"]);
    const ops = makeOps({
      config: baseConfig(),
      repoRoot: fx.repoRoot,
      worktrees: [
        wt(fx.repoRoot, "main"),
        wt(fx.paths["feature/x"] as string, "feature/x"),
        wt(fx.paths["feature/y"] as string, "feature/y"),
      ],
    });
    const prompter = new FakePrompter().script([{ kind: "confirm", value: true }]);
    const deps: CleanFlowDeps = {
      cwd: fx.repoRoot,
      args: { mode: "all", yes: false, noFetch: false },
      prompter,
      ops,
    };
    const result = await cleanFlow(deps);
    expect(prompter.transcript[0]?.kind).toBe("confirm");
    expect(result.outcomes.filter((o) => o.kind === "removed")).toHaveLength(2);
  });

  it("declined confirmation removes nothing and returns cancelled:true", async () => {
    const fx = await setupFixture(["feature/x", "feature/y"]);
    const ops = makeOps({
      config: baseConfig(),
      repoRoot: fx.repoRoot,
      worktrees: [
        wt(fx.repoRoot, "main"),
        wt(fx.paths["feature/x"] as string, "feature/x"),
        wt(fx.paths["feature/y"] as string, "feature/y"),
      ],
    });
    const prompter = new FakePrompter().script([{ kind: "confirm", value: false }]);
    const deps: CleanFlowDeps = {
      cwd: fx.repoRoot,
      args: { mode: "all", yes: false, noFetch: false },
      prompter,
      ops,
    };
    const result = await cleanFlow(deps);
    expect(result.cancelled).toBe(true);
    expect(ops.removeCalls).toEqual([]);
    expect(result.outcomes).toEqual([]);
  });

  it("skips running worktrees in bulk and reports them in outcomes", async () => {
    const fx = await setupFixture(["feature/x", "feature/y", "feature/z"]);
    writeFileSync(join(fx.paths["feature/y"] as string, "peel.lock"), String(process.pid), "utf8");
    const ops = makeOps({
      config: baseConfig(),
      repoRoot: fx.repoRoot,
      worktrees: [
        wt(fx.repoRoot, "main"),
        wt(fx.paths["feature/x"] as string, "feature/x"),
        wt(fx.paths["feature/y"] as string, "feature/y"),
        wt(fx.paths["feature/z"] as string, "feature/z"),
      ],
    });
    const deps: CleanFlowDeps = {
      cwd: fx.repoRoot,
      args: { mode: "all", yes: true, noFetch: false },
      prompter: new FakePrompter(),
      ops,
    };
    const result = await cleanFlow(deps);
    const removed = result.outcomes
      .filter((o) => o.kind === "removed")
      .map((o) => o.branch)
      .sort();
    const skipped = result.outcomes
      .filter((o) => o.kind === "skipped-running")
      .map((o) => o.branch);
    expect(removed).toEqual(["feature/x", "feature/z"]);
    expect(skipped).toEqual(["feature/y"]);
  });
});

describe("cleanFlow — stale (--stale)", () => {
  it("removes worktrees whose branch exists neither locally nor remotely", async () => {
    const fx = await setupFixture(["feature/x", "feature/gone"]);
    const ops = makeOps({
      config: baseConfig(),
      repoRoot: fx.repoRoot,
      worktrees: [
        wt(fx.repoRoot, "main"),
        wt(fx.paths["feature/x"] as string, "feature/x"),
        wt(fx.paths["feature/gone"] as string, "feature/gone"),
      ],
      branches: [
        { name: "main", isRemote: false, committerDate: new Date() },
        { name: "feature/x", isRemote: false, committerDate: new Date() },
        // feature/gone absent both locally and remotely
      ],
    });
    const deps: CleanFlowDeps = {
      cwd: fx.repoRoot,
      args: { mode: "stale", yes: true, noFetch: false },
      prompter: new FakePrompter(),
      ops,
    };
    const result = await cleanFlow(deps);
    const removed = result.outcomes.filter((o) => o.kind === "removed").map((o) => o.branch);
    expect(removed).toEqual(["feature/gone"]);
    expect(ops.removeCalls).toHaveLength(1);
  });

  it("preserves worktrees whose branch still exists locally", async () => {
    const fx = await setupFixture(["feature/x"]);
    const ops = makeOps({
      config: baseConfig(),
      repoRoot: fx.repoRoot,
      worktrees: [wt(fx.repoRoot, "main"), wt(fx.paths["feature/x"] as string, "feature/x")],
      branches: [{ name: "feature/x", isRemote: false, committerDate: new Date() }],
    });
    const deps: CleanFlowDeps = {
      cwd: fx.repoRoot,
      args: { mode: "stale", yes: true, noFetch: false },
      prompter: new FakePrompter(),
      ops,
    };
    const result = await cleanFlow(deps);
    expect(result.outcomes.filter((o) => o.kind === "removed")).toEqual([]);
  });

  it("logs a warning when fetch fails but still computes staleness from local view", async () => {
    const fx = await setupFixture(["feature/gone"]);
    const ops = makeOps({
      config: baseConfig(),
      repoRoot: fx.repoRoot,
      worktrees: [wt(fx.repoRoot, "main"), wt(fx.paths["feature/gone"] as string, "feature/gone")],
      branches: [{ name: "main", isRemote: false, committerDate: new Date() }],
      fetchResult: { ok: false, error: "offline" },
    });
    const warnings: string[] = [];
    const deps: CleanFlowDeps = {
      cwd: fx.repoRoot,
      args: { mode: "stale", yes: true, noFetch: false },
      prompter: new FakePrompter(),
      ops,
      logger: { warn: (m: string) => warnings.push(m) },
    };
    const result = await cleanFlow(deps);
    expect(warnings.some((w) => /fetch/i.test(w))).toBe(true);
    expect(result.outcomes.filter((o) => o.kind === "removed").map((o) => o.branch)).toEqual([
      "feature/gone",
    ]);
    expect(ops.fetchCalls).toBe(1);
  });

  it("skips fetch entirely when noFetch:true", async () => {
    const fx = await setupFixture([]);
    const ops = makeOps({
      config: baseConfig(),
      repoRoot: fx.repoRoot,
      worktrees: [wt(fx.repoRoot, "main")],
    });
    const deps: CleanFlowDeps = {
      cwd: fx.repoRoot,
      args: { mode: "stale", yes: true, noFetch: true },
      prompter: new FakePrompter(),
      ops,
    };
    await cleanFlow(deps);
    expect(ops.fetchCalls).toBe(0);
  });
});

describe("cleanFlow — config gate", () => {
  it("throws CleanFlowError(no-config) when .peel.yml is missing", async () => {
    const fx = await setupFixture([]);
    const ops = makeOps({
      config: null,
      repoRoot: fx.repoRoot,
      worktrees: [wt(fx.repoRoot, "main")],
    });
    const deps: CleanFlowDeps = {
      cwd: fx.repoRoot,
      args: { mode: "all", yes: true, noFetch: false },
      prompter: new FakePrompter(),
      ops,
    };
    await expect(cleanFlow(deps)).rejects.toMatchObject({
      name: "CleanFlowError",
      kind: "no-config",
    });
  });

  it("throws CleanFlowError(no-config) when not in a git repo", async () => {
    const fx = await setupFixture([]);
    const ops = makeOps({
      config: baseConfig(),
      repoRoot: fx.repoRoot,
      worktrees: [],
    });
    ops.findGitRoot = () => null;
    const deps: CleanFlowDeps = {
      cwd: fx.repoRoot,
      args: { mode: "all", yes: true, noFetch: false },
      prompter: new FakePrompter(),
      ops,
    };
    await expect(cleanFlow(deps)).rejects.toBeInstanceOf(CleanFlowError);
  });
});
