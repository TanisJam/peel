import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
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

describe("peel run (integration)", () => {
  it("--yes runs the dev command in a fresh worktree (fake dev exits 0) and cleans up", async () => {
    // Write a .peel.yml whose dev command exits 0 immediately.
    // Dev: print "ready" then exit 0 (single-quoted shell arg avoids YAML/shell quoting hell).
    const cfg = `version: 1
port:
  base: 38000
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
    writeFileSync(join(fx.repoRoot, ".peel.yml"), cfg);

    const result = spawnSync(
      process.execPath,
      [BINARY, "run", "feature/x", "dev", "--yes", "--no-fetch"],
      {
        cwd: fx.repoRoot,
        encoding: "utf8",
        timeout: 30_000,
      },
    );

    expect(
      result.status,
      `exit ${result.status}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    ).toBe(0);
    expect(result.stdout + result.stderr).toContain("ready");

    // After the run with autoCleanup: true and no --keep, the secondary
    // worktree should not exist.
    const expectedDir = `${fx.bareRoot.split("/").pop()}-feature-x`;
    const sibling = resolve(fx.repoRoot, "..", expectedDir);
    expect(existsSync(sibling)).toBe(false);
  });

  it("exits non-zero with a friendly message outside a git repo", async () => {
    const { dir } = await import("tmp-promise");
    const tmp = await dir({ unsafeCleanup: true });
    try {
      const result = spawnSync(
        process.execPath,
        [BINARY, "run", "feature/x", "dev", "--yes", "--no-fetch"],
        { cwd: tmp.path, encoding: "utf8", timeout: 10_000 },
      );
      expect(result.status).not.toBe(0);
      const combined = `${result.stdout}${result.stderr}`.toLowerCase();
      expect(combined).toMatch(/git|peel init/);
    } finally {
      await tmp.cleanup();
    }
  });
});
