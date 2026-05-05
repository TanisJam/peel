import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dir } from "tmp-promise";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CANCEL } from "../ports/prompter.js";
import { FakePrompter, type ScriptStep } from "./__fixtures__/fake-prompter.js";
import { FakeRunner } from "./__fixtures__/fake-runner.js";
import { DEFAULT_CONFIG } from "./config-defaults.js";
import type { Config } from "./config-schema.js";
import type { Branch } from "./git.js";
import { type RunFlowDeps, RunFlowError, runFlow } from "./run-flow.js";

type Cleanup = () => Promise<void>;
const cleanups: Cleanup[] = [];
afterEach(async () => {
  while (cleanups.length) {
    const fn = cleanups.pop();
    if (fn) await fn();
  }
});

async function tmpRepo(): Promise<{ root: string; wt: string }> {
  const d = await dir({ unsafeCleanup: true });
  cleanups.push(d.cleanup);
  mkdirSync(join(d.path, ".git"));
  // Pre-compute the expected worktree path based on default baseDir ".."
  // For the test, we just provide a worktree path in a sibling tmp dir.
  const wt = await dir({ unsafeCleanup: true });
  cleanups.push(wt.cleanup);
  return { root: d.path, wt: wt.path };
}

const sampleBranches: Branch[] = [
  { name: "main", isRemote: false, committerDate: new Date("2026-05-01") },
  { name: "feature/x", isRemote: false, committerDate: new Date("2026-05-04") },
];

const baseConfig = (overrides: Partial<Config> = {}): Config => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

async function defaultWorktreePath(): Promise<string> {
  const d = await dir({ unsafeCleanup: true });
  cleanups.push(d.cleanup);
  // Return a child path that does NOT exist yet, so runFlow's existence
  // check sees "create me".
  return join(d.path, "worktree");
}

function makeOps(opts: {
  config: Config | null;
  branches: Branch[];
  isBusy?: (port: number) => Promise<boolean>;
  findFree?: (base: number, range: number) => Promise<number | null>;
  holder?: { pid: number; command: string } | null;
  worktreePathOverride: string;
}): RunFlowDeps["ops"] & {
  createCalls: { repoRoot: string; path: string; branch: string }[];
  removeCalls: { repoRoot: string; path: string }[];
} {
  const createCalls: { repoRoot: string; path: string; branch: string }[] = [];
  const removeCalls: { repoRoot: string; path: string }[] = [];

  return {
    loadConfig: () => opts.config,
    findGitRoot: (cwd: string) => cwd,
    getRepoName: () => "widget",
    gitFetch: async () => ({ ok: true as const }),
    listBranches: async () => opts.branches,
    isPortBusy: opts.isBusy ?? (async () => false),
    findFreePort: opts.findFree ?? (async (base: number) => base),
    whoHoldsPort: async () => opts.holder ?? null,
    createWorktree: async (a) => {
      createCalls.push(a);
      mkdirSync(a.path, { recursive: true });
    },
    removeWorktree: async (repoRoot: string, path: string) => {
      removeCalls.push({ repoRoot, path });
      return { ok: true as const };
    },
    listWorktrees: async () => [],
    copyEnvFiles: async () => ({ copied: [], skipped: [], missing: [] }),
    worktreePath: () => opts.worktreePathOverride,
    createCalls,
    removeCalls,
  };
}

const happyPromptScript: ScriptStep[] = [];

async function makeDeps(
  args: Partial<RunFlowDeps["args"]> = {},
  overrides: {
    promptScript?: ScriptStep[];
    runScript?: { exitCode: number; stdout: string; stderr: string }[];
    spawnScript?: import("./__fixtures__/fake-runner.js").ScriptedSpawn[];
    config?: Config | null;
    branches?: Branch[];
    isBusy?: (p: number) => Promise<boolean>;
    findFree?: (b: number, r: number) => Promise<number | null>;
    holder?: { pid: number; command: string } | null;
    worktreePathOverride?: string;
  } = {},
): Promise<{
  deps: RunFlowDeps;
  prompter: FakePrompter;
  runner: FakeRunner;
  ops: ReturnType<typeof makeOps>;
}> {
  const prompter = new FakePrompter().script(overrides.promptScript ?? happyPromptScript);
  const runner = new FakeRunner()
    .scriptRun(overrides.runScript ?? [])
    .scriptSpawn(overrides.spawnScript ?? [{ exit: { exitCode: 0, signal: null } }]);

  const wt = overrides.worktreePathOverride ?? (await defaultWorktreePath());
  const ops = makeOps({
    config: overrides.config === undefined ? baseConfig() : overrides.config,
    branches: overrides.branches ?? sampleBranches,
    ...(overrides.isBusy !== undefined ? { isBusy: overrides.isBusy } : {}),
    ...(overrides.findFree !== undefined ? { findFree: overrides.findFree } : {}),
    holder: overrides.holder ?? null,
    worktreePathOverride: wt,
  });

  const deps: RunFlowDeps = {
    cwd: "/repo",
    args: {
      keep: false,
      noFetch: false,
      yes: false,
      ...args,
    },
    prompter,
    runner,
    ops,
  };

  return { deps, prompter, runner, ops };
}

describe("runFlow", () => {
  it("happy path: --yes runs install + hooks + spawn and cleans up", async () => {
    const { deps, runner, ops } = await makeDeps(
      { branch: "feature/x", mode: "dev", yes: true },
      {
        runScript: [{ exitCode: 0, stdout: "", stderr: "" }], // install
        spawnScript: [{ exit: { exitCode: 0, signal: null } }], // dev
      },
    );

    const result = await runFlow(deps);

    expect(result.exitCode).toBe(0);
    expect(ops.createCalls).toHaveLength(1);
    expect(ops.createCalls[0]?.branch).toBe("feature/x");
    expect(runner.runCalls.map((c) => c.command)).toContain("npm install");
    expect(runner.spawnCalls.map((c) => c.command)).toContain("npm run dev");
    expect(ops.removeCalls).toHaveLength(1); // cleanup at end
  });

  it("missing config throws RunFlowError(no-config)", async () => {
    const { deps } = await makeDeps({}, { config: null });
    try {
      await runFlow(deps);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RunFlowError);
      expect((err as RunFlowError).kind).toBe("no-config");
    }
  });

  it("cancel mid-picker exits 0 without creating a worktree", async () => {
    const { deps, ops } = await makeDeps(
      { yes: false },
      {
        promptScript: [{ kind: "select", value: CANCEL }],
        spawnScript: [],
      },
    );

    const result = await runFlow(deps);
    expect(result.exitCode).toBe(0);
    expect(ops.createCalls).toHaveLength(0);
  });

  it("port-busy on fixed throws RunFlowError(port-busy) with holder", async () => {
    const { deps, ops } = await makeDeps(
      { branch: "feature/x", mode: "dev", yes: true },
      {
        config: baseConfig({ port: { base: 3000, strategy: "fixed" } }),
        isBusy: async () => true,
        holder: { pid: 12345, command: "next-server" },
        spawnScript: [],
      },
    );

    try {
      await runFlow(deps);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RunFlowError);
      const e = err as RunFlowError;
      expect(e.kind).toBe("port-busy");
      expect(e.detail).toMatchObject({ port: 3000 });
    }
    expect(ops.createCalls).toHaveLength(0);
  });

  it("auto-find skips busy and uses next free port", async () => {
    const { deps } = await makeDeps(
      { branch: "feature/x", mode: "dev", yes: true },
      {
        config: baseConfig({ port: { base: 3000, strategy: "auto-find" } }),
        isBusy: async (p) => p === 3000,
        findFree: async () => 3001,
        runScript: [{ exitCode: 0, stdout: "", stderr: "" }],
      },
    );

    const result = await runFlow(deps);
    expect(result.exitCode).toBe(0);
  });

  it("install-failed cleans up the worktree and throws RunFlowError(install-failed)", async () => {
    const { deps, ops } = await makeDeps(
      { branch: "feature/x", mode: "dev", yes: true },
      {
        runScript: [{ exitCode: 1, stdout: "", stderr: "boom" }], // install fails
        spawnScript: [],
      },
    );

    try {
      await runFlow(deps);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RunFlowError);
      expect((err as RunFlowError).kind).toBe("install-failed");
    }
    expect(ops.removeCalls).toHaveLength(1);
  });

  it("hook-failed cleans up and throws RunFlowError(hook-failed, failedAt)", async () => {
    const { deps, ops } = await makeDeps(
      { branch: "feature/x", mode: "dev", yes: true },
      {
        config: baseConfig({ preRun: ["pnpm prisma generate"] }),
        runScript: [
          { exitCode: 0, stdout: "", stderr: "" }, // install ok
          { exitCode: 2, stdout: "", stderr: "hook boom" }, // hook fails
        ],
        spawnScript: [],
      },
    );

    try {
      await runFlow(deps);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RunFlowError);
      const e = err as RunFlowError;
      expect(e.kind).toBe("hook-failed");
      expect(e.detail).toMatchObject({ failedAt: 0, exitCode: 2 });
    }
    expect(ops.removeCalls).toHaveLength(1);
  });

  it("--keep with existing worktree+node_modules skips create and install", async () => {
    const tmp = await tmpRepo();
    mkdirSync(join(tmp.wt, "node_modules"));

    const { deps, runner, ops } = await makeDeps(
      { branch: "feature/x", mode: "dev", yes: true, keep: true },
      {
        worktreePathOverride: tmp.wt,
        runScript: [], // install must NOT be called
        spawnScript: [{ exit: { exitCode: 0, signal: null } }],
      },
    );

    const result = await runFlow(deps);
    expect(result.exitCode).toBe(0);
    expect(ops.createCalls).toHaveLength(0);
    expect(runner.runCalls).toHaveLength(0); // no install
    expect(ops.removeCalls).toHaveLength(0); // --keep skips cleanup
  });

  it("peel.lock with live PID throws RunFlowError(locked)", async () => {
    const tmp = await tmpRepo();
    // Pre-create the worktree path so we can plant a lock file.
    writeFileSync(join(tmp.wt, "peel.lock"), String(process.pid)); // current PID is alive

    const { deps, ops } = await makeDeps(
      { branch: "feature/x", mode: "dev", yes: true },
      {
        worktreePathOverride: tmp.wt,
        spawnScript: [],
      },
    );

    try {
      await runFlow(deps);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RunFlowError);
      expect((err as RunFlowError).kind).toBe("locked");
    }
    expect(ops.createCalls).toHaveLength(0);
  });

  it("branch-not-found throws RunFlowError(branch-not-found, suggestions)", async () => {
    const { deps } = await makeDeps(
      { branch: "feature/z", mode: "dev", yes: true },
      { spawnScript: [] },
    );

    try {
      await runFlow(deps);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RunFlowError);
      const e = err as RunFlowError;
      expect(e.kind).toBe("branch-not-found");
      expect((e.detail as { suggestions: string[] }).suggestions).toContain("feature/x");
    }
  });
});
