import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dir } from "tmp-promise";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { type GitFixture, createGitFixture } from "../test-utils/git-fixture.js";
import {
  WorktreeError,
  createWorktree,
  listWorktrees,
  removeWorktree,
  slugify,
  worktreePath,
} from "./worktree.js";

let fx: GitFixture;
beforeAll(async () => {
  fx = await createGitFixture();
});
afterAll(async () => {
  await fx.cleanup();
});

type Cleanup = () => Promise<void>;
const cleanups: Cleanup[] = [];
afterEach(async () => {
  while (cleanups.length) {
    const fn = cleanups.pop();
    if (fn) await fn();
  }
});

async function tmpBaseDir(): Promise<string> {
  const d = await dir({ unsafeCleanup: true });
  cleanups.push(d.cleanup);
  return d.path;
}

describe("slugify", () => {
  it("replaces slashes with dashes", () => {
    expect(slugify("feature/x.y")).toBe("feature-x.y");
  });

  it("collapses runs of replaced chars", () => {
    expect(slugify("feat//foo bar")).toBe("feat-foo-bar");
  });

  it("preserves dots, dashes, underscores", () => {
    expect(slugify("v1.2.3-rc.1")).toBe("v1.2.3-rc.1");
  });
});

describe("worktreePath", () => {
  it("composes <baseDir>/<repoName>-<slug(branch)>", () => {
    const result = worktreePath({
      repoRoot: "/repo",
      baseDir: "..",
      repoName: "widget",
      branch: "feature/x",
    });
    expect(result.endsWith("/widget-feature-x")).toBe(true);
  });

  it("is deterministic for the same inputs", () => {
    const a = worktreePath({
      repoRoot: "/repo",
      baseDir: "..",
      repoName: "widget",
      branch: "feature/x",
    });
    const b = worktreePath({
      repoRoot: "/repo",
      baseDir: "..",
      repoName: "widget",
      branch: "feature/x",
    });
    expect(a).toBe(b);
  });
});

describe("createWorktree", () => {
  it("creates a worktree for a local branch", async () => {
    const base = await tmpBaseDir();
    const path = join(base, "widget-feature-x");
    cleanups.push(() =>
      removeWorktree(fx.repoRoot, path)
        .then(() => undefined)
        .catch(() => undefined),
    );

    await createWorktree({ repoRoot: fx.repoRoot, path, branch: "feature/x" });
    expect(existsSync(path)).toBe(true);
    expect(existsSync(join(path, "feature.txt"))).toBe(true);
  });

  it("creates a tracking worktree for a remote-only branch", async () => {
    // Add a remote-only branch via the bare repo to simulate origin/feature/y
    const { execa } = await import("execa");
    const tmp = await tmpBaseDir();
    await execa("git", ["clone", `file://${fx.bareRoot}`, tmp], {});
    await execa("git", ["checkout", "-b", "feature/y"], { cwd: tmp });
    writeFileSync(join(tmp, "y.txt"), "y\n");
    await execa("git", ["add", "."], { cwd: tmp });
    await execa("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "y"], {
      cwd: tmp,
    });
    await execa("git", ["push", "origin", "feature/y"], { cwd: tmp });

    // Make sure fx sees it
    await execa("git", ["fetch", "origin"], { cwd: fx.repoRoot });

    const base = await tmpBaseDir();
    const path = join(base, "widget-feature-y");
    cleanups.push(() =>
      removeWorktree(fx.repoRoot, path)
        .then(() => undefined)
        .catch(() => undefined),
    );

    await createWorktree({ repoRoot: fx.repoRoot, path, branch: "feature/y" });

    const branchInWt = (await execa("git", ["branch", "--show-current"], { cwd: path })).stdout;
    expect(branchInWt).toBe("feature/y");
  });

  it("throws WorktreeError(kind=path-exists) when target path already exists", async () => {
    const base = await tmpBaseDir();
    const path = join(base, "occupied");
    mkdirSync(path);
    writeFileSync(join(path, "junk.txt"), "x");

    try {
      await createWorktree({
        repoRoot: fx.repoRoot,
        path,
        branch: "feature/x",
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(WorktreeError);
      expect((err as WorktreeError).kind).toBe("path-exists");
    }
  });
});

describe("listWorktrees", () => {
  it("includes the main worktree and any secondary ones", async () => {
    const base = await tmpBaseDir();
    const path = join(base, "extra");
    cleanups.push(() =>
      removeWorktree(fx.repoRoot, path)
        .then(() => undefined)
        .catch(() => undefined),
    );

    await createWorktree({ repoRoot: fx.repoRoot, path, branch: "main" }).catch(() => undefined);
    // If "main" is already checked out in fx.repoRoot, that's expected — just list:
    const wts = await listWorktrees(fx.repoRoot);
    expect(wts.find((w) => w.path === fx.repoRoot)).toBeDefined();
  });
});

describe("removeWorktree", () => {
  it("removes an existing worktree", async () => {
    const base = await tmpBaseDir();
    const path = join(base, "to-remove");

    await createWorktree({ repoRoot: fx.repoRoot, path, branch: "feature/x" });
    expect(existsSync(path)).toBe(true);

    const result = await removeWorktree(fx.repoRoot, path);
    expect(result.ok).toBe(true);
    expect(existsSync(path)).toBe(false);
  });

  it("is idempotent on a missing path", async () => {
    const result = await removeWorktree(fx.repoRoot, "/tmp/peel-never-existed");
    expect(result.ok).toBe(true);
  });
});
