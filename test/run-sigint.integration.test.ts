import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type GitFixture, createGitFixture } from "../src/test-utils/git-fixture.js";

const BINARY = resolve(process.cwd(), "dist/index.js");
const READY_MARKER = "PEEL_TEST_READY";

let fx: GitFixture;
beforeAll(async () => {
  fx = await createGitFixture();
});
afterAll(async () => {
  await fx.cleanup();
});

const cfgWithSleepingDev = `version: 1
port:
  base: 38200
  strategy: auto-find
envFiles: []
packageManager: npm
commands:
  install: "true"
  dev: "node -e 'console.log(\\"${READY_MARKER}\\");setInterval(()=>{},1000)'"
  build: "true"
  start: "true"
preRun: []
worktree:
  baseDir: ".."
  prefix: ""
  autoCleanup: true
git:
  fetchOnStart: false
  includeRemoteBranches: true
  excludeBranches: []
`;

type ExitInfo = {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

async function spawnPeelRunUntilReady(args: string[]): Promise<{
  child: ReturnType<typeof spawn>;
  exited: Promise<ExitInfo>;
  ready: Promise<void>;
}> {
  const child = spawn(process.execPath, [BINARY, ...args], {
    cwd: fx.repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let resolveReady: () => void = () => {};
  let rejectReady: (err: Error) => void = () => {};
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const onData = (chunk: Buffer | string): void => {
    const text = String(chunk);
    stdout += text;
    if (text.includes(READY_MARKER)) resolveReady();
  };
  child.stdout?.on("data", onData);
  child.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const exited = new Promise<ExitInfo>((resolve) => {
    child.on("exit", (code, signal) => {
      resolve({ code, signal, stdout, stderr });
    });
  });

  // Fail-fast: if the process exits before the ready marker arrives,
  // reject the ready promise with the captured output.
  child.on("exit", (code, signal) => {
    rejectReady(
      new Error(
        `peel exited (code=${code} signal=${signal}) before ready marker.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`,
      ),
    );
  });

  return { child, exited, ready };
}

describe("peel run SIGINT cleanup (integration)", () => {
  it("SIGINT to the parent triggers cleanup: worktree is removed", async () => {
    writeFileSync(join(fx.repoRoot, ".peel.yml"), cfgWithSleepingDev);
    const repoName = basename(fx.bareRoot);
    const expectedDir = `${repoName}-feature-x`;
    const sibling = resolve(fx.repoRoot, "..", expectedDir);

    const { child, exited, ready } = await spawnPeelRunUntilReady([
      "run",
      "feature/x",
      "dev",
      "--yes",
      "--no-fetch",
    ]);
    await ready;

    // Worktree must exist while the dev process is alive.
    expect(existsSync(sibling)).toBe(true);

    // Send SIGINT to the parent peel process. Default for child.kill() is SIGTERM,
    // so we pass SIGINT explicitly.
    child.kill("SIGINT");

    const result = await exited;

    // Either an exit code (130 == 128+SIGINT) or a signal — both are acceptable
    // depending on how Node reports it on this platform.
    const exitedOnSigint = result.code === 130 || result.signal === "SIGINT" || result.code === 0;
    expect(
      exitedOnSigint,
      `unexpected exit\ncode=${result.code} signal=${result.signal}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    ).toBe(true);

    // Cleanup ran — worktree is gone.
    expect(
      existsSync(sibling),
      `worktree at ${sibling} still exists after SIGINT\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    ).toBe(false);
  }, 30_000);

  it("SIGINT with --keep preserves the worktree", async () => {
    writeFileSync(join(fx.repoRoot, ".peel.yml"), cfgWithSleepingDev);
    const repoName = basename(fx.bareRoot);
    const expectedDir = `${repoName}-feature-x`;
    const sibling = resolve(fx.repoRoot, "..", expectedDir);

    const { child, exited, ready } = await spawnPeelRunUntilReady([
      "run",
      "feature/x",
      "dev",
      "--yes",
      "--no-fetch",
      "--keep",
    ]);
    await ready;

    expect(existsSync(sibling)).toBe(true);

    child.kill("SIGINT");
    const result = await exited;

    expect(
      existsSync(sibling),
      `worktree at ${sibling} was removed despite --keep\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    ).toBe(true);

    // Cleanup follow-up (run after assertions): tear down the kept worktree.
    const { execaSync } = await import("execa");
    execaSync("git", ["worktree", "remove", "--force", sibling], {
      cwd: fx.repoRoot,
      reject: false,
    });
  }, 30_000);
});
