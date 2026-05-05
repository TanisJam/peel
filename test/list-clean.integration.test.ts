import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type GitFixture, createGitFixture } from "../src/test-utils/git-fixture.js";

const BINARY = resolve(process.cwd(), "dist/index.js");

let fx: GitFixture;
beforeAll(async () => {
  fx = await createGitFixture();
});
afterAll(async () => {
  await fx.cleanup();
});

const peelCfg = `version: 1
port:
  base: 38100
  strategy: auto-find
envFiles: []
packageManager: npm
commands:
  install: "true"
  dev: "node -e 'console.log(\\"ready\\");process.exit(0)'"
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

describe("peel list + peel clean (integration)", () => {
  it("list shows the worktree created by --keep, then clean removes it", () => {
    writeFileSync(join(fx.repoRoot, ".peel.yml"), peelCfg);
    const repoName = basename(fx.bareRoot);
    const expectedDir = `${repoName}-feature-x`;
    const sibling = resolve(fx.repoRoot, "..", expectedDir);

    // 1. peel run --keep so the worktree persists.
    const runResult = spawnSync(
      process.execPath,
      [BINARY, "run", "feature/x", "dev", "--yes", "--no-fetch", "--keep"],
      { cwd: fx.repoRoot, encoding: "utf8", timeout: 30_000 },
    );
    expect(
      runResult.status,
      `run exit ${runResult.status}\nSTDOUT:\n${runResult.stdout}\nSTDERR:\n${runResult.stderr}`,
    ).toBe(0);
    expect(existsSync(sibling)).toBe(true);

    // 2. peel list shows the worktree.
    const listResult = spawnSync(process.execPath, [BINARY, "list"], {
      cwd: fx.repoRoot,
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(listResult.status).toBe(0);
    expect(listResult.stdout).toContain("feature/x");
    expect(listResult.stdout).toContain(expectedDir);

    // 3. peel clean feature/x removes it.
    const cleanResult = spawnSync(process.execPath, [BINARY, "clean", "feature/x", "--yes"], {
      cwd: fx.repoRoot,
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(
      cleanResult.status,
      `clean exit ${cleanResult.status}\nSTDOUT:\n${cleanResult.stdout}\nSTDERR:\n${cleanResult.stderr}`,
    ).toBe(0);
    expect(existsSync(sibling)).toBe(false);

    // 4. peel list now shows the empty state.
    const listAfter = spawnSync(process.execPath, [BINARY, "list"], {
      cwd: fx.repoRoot,
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(listAfter.status).toBe(0);
    expect(listAfter.stdout.toLowerCase()).toContain("no peel-managed");
  });

  it("list and clean exit non-zero outside a git repo", async () => {
    const { dir } = await import("tmp-promise");
    const tmp = await dir({ unsafeCleanup: true });
    try {
      const listResult = spawnSync(process.execPath, [BINARY, "list"], {
        cwd: tmp.path,
        encoding: "utf8",
        timeout: 5_000,
      });
      expect(listResult.status).not.toBe(0);
      expect(listResult.stderr.toLowerCase()).toMatch(/peel init|git/);

      const cleanResult = spawnSync(process.execPath, [BINARY, "clean", "--all", "--yes"], {
        cwd: tmp.path,
        encoding: "utf8",
        timeout: 5_000,
      });
      expect(cleanResult.status).not.toBe(0);
      expect(cleanResult.stderr.toLowerCase()).toMatch(/peel init|git/);
    } finally {
      await tmp.cleanup();
    }
  });
});
