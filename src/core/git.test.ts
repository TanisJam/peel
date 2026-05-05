import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import { dir } from "tmp-promise";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { type GitFixture, createGitFixture } from "../test-utils/git-fixture.js";
import { currentBranch, findGitRoot, getRepoName, gitFetch, listBranches } from "./git.js";

type Cleanup = () => Promise<void>;
const localCleanups: Cleanup[] = [];
afterEach(async () => {
  while (localCleanups.length) {
    const fn = localCleanups.pop();
    if (fn) await fn();
  }
});

let fx: GitFixture;
beforeAll(async () => {
  fx = await createGitFixture();
});
afterAll(async () => {
  await fx.cleanup();
});

describe("findGitRoot", () => {
  it("returns the repo root from a nested path", () => {
    const sub = join(fx.repoRoot, "packages", "app");
    mkdirSync(sub, { recursive: true });
    expect(findGitRoot(sub)).toBe(fx.repoRoot);
  });

  it("returns null outside any repo", async () => {
    const d = await dir({ unsafeCleanup: true });
    localCleanups.push(d.cleanup);
    expect(findGitRoot(d.path)).toBeNull();
  });
});

describe("getRepoName", () => {
  it("uses the origin URL last segment", () => {
    // The fixture's origin is file://<bareRoot>; last segment is the bare dir basename.
    const expected = fx.bareRoot.split("/").pop();
    expect(getRepoName(fx.repoRoot)).toBe(expected);
  });

  it("falls back to dir basename when no origin is configured", async () => {
    const d = await dir({ unsafeCleanup: true });
    localCleanups.push(d.cleanup);
    await execa("git", ["init", "-b", "main"], { cwd: d.path });
    const basename = d.path.split("/").pop();
    expect(getRepoName(d.path)).toBe(basename);
  });

  it("strips .git suffix from origin URLs", async () => {
    const d = await dir({ unsafeCleanup: true });
    localCleanups.push(d.cleanup);
    await execa("git", ["init", "-b", "main"], { cwd: d.path });
    await execa("git", ["remote", "add", "origin", "git@github.com:acme/widget.git"], {
      cwd: d.path,
    });
    expect(getRepoName(d.path)).toBe("widget");
  });
});

describe("currentBranch", () => {
  it("returns the symbolic ref name", () => {
    expect(currentBranch(fx.repoRoot)).toBe("main");
  });

  it("returns null on detached HEAD", async () => {
    const d = await dir({ unsafeCleanup: true });
    localCleanups.push(d.cleanup);
    await execa("git", ["init", "-b", "main"], { cwd: d.path });
    writeFileSync(join(d.path, "f.txt"), "hi");
    await execa("git", ["add", "."], { cwd: d.path });
    await execa("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "x"], {
      cwd: d.path,
    });
    const head = (await execa("git", ["rev-parse", "HEAD"], { cwd: d.path })).stdout;
    await execa("git", ["checkout", head], { cwd: d.path });
    expect(currentBranch(d.path)).toBeNull();
  });
});

describe("gitFetch", () => {
  it("returns ok:true against the fixture's file:// origin", async () => {
    const result = await gitFetch(fx.repoRoot);
    expect(result).toEqual({ ok: true });
  });

  it("returns ok:false without throwing when no origin is configured", async () => {
    const d = await dir({ unsafeCleanup: true });
    localCleanups.push(d.cleanup);
    await execa("git", ["init", "-b", "main"], { cwd: d.path });

    const result = await gitFetch(d.path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});

describe("listBranches", () => {
  it("deduplicates local and origin entries", async () => {
    const branches = await listBranches(fx.repoRoot);
    const names = branches.map((b) => b.name);
    expect(names).toContain("feature/x");
    expect(names.filter((n) => n === "feature/x")).toHaveLength(1);
  });

  it("sorts by committerdate desc (newest first)", async () => {
    const branches = await listBranches(fx.repoRoot);
    const idxFeature = branches.findIndex((b) => b.name === "feature/x");
    const idxMain = branches.findIndex((b) => b.name === "main");
    expect(idxFeature).toBeGreaterThanOrEqual(0);
    expect(idxMain).toBeGreaterThanOrEqual(0);
    expect(idxFeature).toBeLessThan(idxMain);
  });

  it("respects exclude patterns", async () => {
    const branches = await listBranches(fx.repoRoot, { exclude: ["feature/*"] });
    expect(branches.find((b) => b.name === "feature/x")).toBeUndefined();
    expect(branches.find((b) => b.name === "main")).toBeDefined();
  });
});
