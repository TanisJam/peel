import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Prompter } from "../ports/prompter.js";
import { isCancel } from "../ports/prompter.js";
import type { Runner, SpawnHandle } from "../ports/runner.js";
import { BranchNotFoundError, pickBranch } from "./branch-picker.js";
import { buildCleanupHandler, installCleanupTrap } from "./cleanup.js";
import type { Config, PortStrategy } from "./config-schema.js";
import { type EnvCopyResult, copyEnvFiles } from "./env-copy.js";
import type { Branch } from "./git.js";
import type { FetchResult } from "./git.js";
import { runHooks } from "./hooks.js";
import { runInstall } from "./installer.js";
import type { Worktree } from "./worktree.js";

type WorktreePathFn = (args: {
  repoRoot: string;
  baseDir: string;
  repoName: string;
  branch: string;
}) => string;

export type RunFlowOps = {
  loadConfig: (cwd: string) => Config | null;
  findGitRoot: (cwd: string) => string | null;
  getRepoName: (repoRoot: string) => string;
  gitFetch: (repoRoot: string) => Promise<FetchResult>;
  listBranches: (repoRoot: string) => Promise<Branch[]>;
  isPortBusy: (port: number) => Promise<boolean>;
  findFreePort: (base: number, range: number) => Promise<number | null>;
  whoHoldsPort: (port: number) => Promise<{ pid: number; command: string } | null>;
  createWorktree: (args: {
    repoRoot: string;
    path: string;
    branch: string;
  }) => Promise<void>;
  removeWorktree: (repoRoot: string, path: string) => Promise<{ ok: true }>;
  listWorktrees: (repoRoot: string) => Promise<Worktree[]>;
  copyEnvFiles?: (args: {
    src: string;
    dest: string;
    files: string[];
  }) => Promise<EnvCopyResult>;
  worktreePath: WorktreePathFn;
};

export type RunFlowArgs = {
  branch?: string;
  mode?: "dev" | "build";
  port?: number;
  keep: boolean;
  noFetch: boolean;
  yes: boolean;
};

export type RunFlowDeps = {
  cwd: string;
  args: RunFlowArgs;
  prompter: Prompter;
  runner: Runner;
  ops: RunFlowOps;
  logger?: { info?: (m: string) => void; warn?: (m: string) => void };
};

export type RunFlowResult = { exitCode: number };

export type RunFlowErrorKind =
  | "no-config"
  | "branch-not-found"
  | "port-busy"
  | "install-failed"
  | "hook-failed"
  | "locked"
  | "cancelled";

export class RunFlowError extends Error {
  constructor(
    message: string,
    public readonly kind: RunFlowErrorKind,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "RunFlowError";
  }
}

const PORT_RANGE = 20;
const LOCK_FILE = "peel.lock";

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EPERM") return true;
    return false;
  }
}

async function pickMode(
  prompter: Prompter,
  explicit: "dev" | "build" | undefined,
): Promise<"dev" | "build" | null> {
  if (explicit) return explicit;
  const choice = await prompter.select({
    message: "Mode?",
    options: [
      { value: "dev", label: "dev" },
      { value: "build", label: "build" },
    ],
    initialValue: "dev",
  });
  if (isCancel(choice)) return null;
  return choice as "dev" | "build";
}

async function resolvePort(config: Config, ops: RunFlowOps, override?: number): Promise<number> {
  const base = override ?? config.port.base;
  const strategy: PortStrategy = config.port.strategy;
  if (strategy === "fixed") {
    if (await ops.isPortBusy(base)) {
      const holder = await ops.whoHoldsPort(base);
      throw new RunFlowError(`Port ${base} is in use`, "port-busy", { port: base, holder });
    }
    return base;
  }
  // auto-find
  const free = await ops.findFreePort(base, PORT_RANGE);
  if (free === null) {
    throw new RunFlowError(`No free port found in [${base}, ${base + PORT_RANGE})`, "port-busy", {
      port: base,
      holder: null,
    });
  }
  return free;
}

function checkLock(worktreePath: string): void {
  if (!existsSync(worktreePath)) return;
  const lockPath = join(worktreePath, LOCK_FILE);
  if (!existsSync(lockPath)) return;
  const raw = readFileSync(lockPath, "utf8").trim();
  const pid = Number.parseInt(raw, 10);
  if (Number.isFinite(pid) && isProcessAlive(pid)) {
    throw new RunFlowError(`Another peel run is in progress (PID ${pid})`, "locked", {
      pid,
      worktreePath,
    });
  }
  // Stale — remove
  try {
    unlinkSync(lockPath);
  } catch {
    /* noop */
  }
}

function writeLock(worktreePath: string): void {
  const lockPath = join(worktreePath, LOCK_FILE);
  try {
    writeFileSync(lockPath, String(process.pid), { encoding: "utf8" });
  } catch {
    /* noop */
  }
}

function removeLock(worktreePath: string): void {
  try {
    unlinkSync(join(worktreePath, LOCK_FILE));
  } catch {
    /* noop */
  }
}

function commandFor(config: Config, mode: "dev" | "build"): string {
  return mode === "dev" ? config.commands.dev : config.commands.build;
}

export async function runFlow(deps: RunFlowDeps): Promise<RunFlowResult> {
  const { cwd, args, prompter, runner, ops, logger } = deps;

  const repoRoot = ops.findGitRoot(cwd);
  if (!repoRoot) {
    throw new RunFlowError("Not in a git repository", "no-config");
  }

  const config = ops.loadConfig(cwd);
  if (!config) {
    throw new RunFlowError("No .peel.yml found. Run `peel init` first.", "no-config");
  }

  // Optional fetch (best-effort)
  if (!args.noFetch && config.git.fetchOnStart) {
    const fetched = await ops.gitFetch(repoRoot);
    if (!fetched.ok) {
      logger?.warn?.(`git fetch failed: ${fetched.error} — continuing with local branches`);
    }
  }

  const branches = await ops.listBranches(repoRoot);

  let chosenBranch: string;
  try {
    const picked = await pickBranch({
      prompter,
      branches,
      ...(args.branch !== undefined ? { explicit: args.branch } : {}),
    });
    if (picked === null) return { exitCode: 0 }; // cancel
    chosenBranch = picked;
  } catch (err) {
    if (err instanceof BranchNotFoundError) {
      throw new RunFlowError(err.message, "branch-not-found", {
        name: args.branch,
        suggestions: err.suggestions,
      });
    }
    throw err;
  }

  const mode = await pickMode(prompter, args.mode);
  if (mode === null) return { exitCode: 0 };

  const port = await resolvePort(config, ops, args.port);

  const repoName = ops.getRepoName(repoRoot);
  const worktreePath = ops.worktreePath({
    repoRoot,
    baseDir: config.worktree.baseDir,
    repoName,
    branch: chosenBranch,
  });

  checkLock(worktreePath);

  const reuse =
    args.keep && existsSync(worktreePath) && existsSync(join(worktreePath, "node_modules"));

  if (!reuse) {
    if (!existsSync(worktreePath)) {
      await ops.createWorktree({
        repoRoot,
        path: worktreePath,
        branch: chosenBranch,
      });
    }
  }

  writeLock(worktreePath);

  const cleanup = buildCleanupHandler({
    removeWorktree: ops.removeWorktree,
    repoRoot,
    worktreePath,
    keep: args.keep,
    ...(logger ? { logger } : {}),
  });

  try {
    const copyFn = ops.copyEnvFiles ?? copyEnvFiles;
    await copyFn({
      src: repoRoot,
      dest: worktreePath,
      files: config.envFiles,
    });

    if (!reuse) {
      const installResult = await runInstall({
        runner,
        cwd: worktreePath,
        command: config.commands.install,
        skipIfNodeModules: args.keep,
      });
      if (!installResult.ok) {
        await cleanup();
        throw new RunFlowError("Install failed", "install-failed", installResult);
      }
    }

    const hooksResult = await runHooks({
      runner,
      cwd: worktreePath,
      hooks: config.preRun,
    });
    if (!hooksResult.ok) {
      await cleanup();
      throw new RunFlowError(
        `Pre-run hook failed at index ${hooksResult.failedAt}`,
        "hook-failed",
        hooksResult,
      );
    }

    logger?.info?.(`peel: starting ${mode} for ${chosenBranch} on port ${port}`);

    const handle: SpawnHandle = runner.spawn({
      command: commandFor(config, mode),
      cwd: worktreePath,
    });

    // Forward parent SIGINT/SIGTERM to the child and run cleanup once it exits.
    const unregister = installCleanupTrap(async () => {
      handle.kill("SIGINT");
      await cleanup();
    });

    let exit: { exitCode: number | null; signal: NodeJS.Signals | null };
    try {
      exit = await handle.exited;
    } finally {
      unregister();
    }
    removeLock(worktreePath);
    await cleanup();
    return { exitCode: exit.exitCode ?? 0 };
  } catch (err) {
    if (!(err instanceof RunFlowError)) {
      await cleanup();
    }
    throw err;
  }
}
