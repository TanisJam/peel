import { existsSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { createGitFixture } from "./git-fixture.js";

type Cleanup = () => Promise<void>;
const cleanups: Cleanup[] = [];
afterEach(async () => {
  while (cleanups.length) {
    const fn = cleanups.pop();
    if (fn) await fn();
  }
});

describe("createGitFixture", () => {
  it("creates a working repo with a bare origin and 2 branches", async () => {
    const fx = await createGitFixture();
    cleanups.push(fx.cleanup);

    expect(existsSync(fx.repoRoot)).toBe(true);
    expect(existsSync(fx.bareRoot)).toBe(true);
    expect(existsSync(`${fx.repoRoot}/.git`)).toBe(true);
    expect(fx.branches.sort()).toEqual(["feature/x", "main"]);
  });

  it("origin remote points to the bare repo via file://", async () => {
    const fx = await createGitFixture();
    cleanups.push(fx.cleanup);

    const { execa } = await import("execa");
    const { stdout } = await execa("git", ["remote", "get-url", "origin"], {
      cwd: fx.repoRoot,
    });
    expect(stdout).toBe(`file://${fx.bareRoot}`);
  });

  it("cleanup() removes both directories", async () => {
    const fx = await createGitFixture();
    await fx.cleanup();

    expect(existsSync(fx.repoRoot)).toBe(false);
    expect(existsSync(fx.bareRoot)).toBe(false);
  });

  it("origin/feature/x is fetched and visible", async () => {
    const fx = await createGitFixture();
    cleanups.push(fx.cleanup);

    const { execa } = await import("execa");
    const { stdout } = await execa(
      "git",
      ["for-each-ref", "--format=%(refname:short)", "refs/remotes/origin"],
      { cwd: fx.repoRoot },
    );
    expect(stdout.split("\n").sort()).toContain("origin/feature/x");
  });
});
