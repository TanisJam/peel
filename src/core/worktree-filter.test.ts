import { utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dir } from "tmp-promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  filterToolWorktrees,
  formatAge,
  getWorktreeAge,
  getWorktreeStatus,
} from "./worktree-filter.js";
import type { Worktree } from "./worktree.js";

describe("filterToolWorktrees", () => {
  const ctx = { repoRoot: "/r", baseDir: "..", repoName: "myrepo" };
  // baseDir resolves to /
  const main: Worktree = { path: "/r", branch: "main", head: "abc" };
  const tool1: Worktree = {
    path: "/myrepo-feature-x",
    branch: "feature/x",
    head: "def",
  };
  const tool2: Worktree = {
    path: "/myrepo-feature-y",
    branch: "feature/y",
    head: "ghi",
  };
  const foreign: Worktree = {
    path: "/somewhere/else/myrepo-feature-x",
    branch: "feature/x",
    head: "abc",
  };
  const detached: Worktree = {
    path: "/myrepo-feature-z",
    branch: null,
    head: "xyz",
  };
  const wrongName: Worktree = {
    path: "/otherrepo-feature-x",
    branch: "feature/x",
    head: "abc",
  };

  it("includes basename-matching tool worktrees and excludes the main repoRoot", () => {
    const result = filterToolWorktrees([main, tool1, tool2], ctx);
    expect(result.map((w) => w.path)).toEqual([tool1.path, tool2.path]);
  });

  it("excludes paths outside baseDir", () => {
    const result = filterToolWorktrees([main, tool1, foreign], ctx);
    expect(result.map((w) => w.path)).toEqual([tool1.path]);
  });

  it("excludes detached HEAD worktrees", () => {
    const result = filterToolWorktrees([tool1, detached], ctx);
    expect(result.map((w) => w.path)).toEqual([tool1.path]);
  });

  it("excludes worktrees whose basename doesn't match <repoName>-<slug>", () => {
    const result = filterToolWorktrees([tool1, wrongName], ctx);
    expect(result.map((w) => w.path)).toEqual([tool1.path]);
  });

  it("includes a worktree only when slug round-trips from branch", () => {
    // basename has a typo against the branch slug
    const renamed: Worktree = {
      path: "/myrepo-feature-typo",
      branch: "feature/x",
      head: "abc",
    };
    const result = filterToolWorktrees([renamed], ctx);
    expect(result).toEqual([]);
  });
});

describe("getWorktreeStatus", () => {
  let tmp: { path: string; cleanup: () => Promise<void> };
  beforeAll(async () => {
    tmp = await dir({ unsafeCleanup: true });
  });
  afterAll(async () => {
    await tmp.cleanup();
  });

  it("returns 'idle' when no peel.lock exists", () => {
    expect(getWorktreeStatus(tmp.path)).toBe("idle");
  });

  it("returns 'running' when peel.lock contains the current process PID", async () => {
    await writeFile(join(tmp.path, "peel.lock"), String(process.pid), "utf8");
    expect(getWorktreeStatus(tmp.path)).toBe("running");
  });

  it("returns 'idle' when peel.lock contains a dead PID", async () => {
    // PID 1 may or may not be alive; use a very high improbable PID instead.
    const dead = 2 ** 30; // ~1B
    await writeFile(join(tmp.path, "peel.lock"), String(dead), "utf8");
    expect(getWorktreeStatus(tmp.path)).toBe("idle");
  });

  it("returns 'idle' when peel.lock is malformed", async () => {
    await writeFile(join(tmp.path, "peel.lock"), "not-a-number", "utf8");
    expect(getWorktreeStatus(tmp.path)).toBe("idle");
  });
});

describe("getWorktreeAge", () => {
  it("returns ms since the directory mtime, monotonically increasing in real time", async () => {
    const tmp = await dir({ unsafeCleanup: true });
    try {
      // Force mtime to 5 seconds ago.
      const fiveSecAgo = new Date(Date.now() - 5000);
      await utimes(tmp.path, fiveSecAgo, fiveSecAgo);
      const age = getWorktreeAge(tmp.path);
      expect(age).toBeGreaterThanOrEqual(4500);
      expect(age).toBeLessThanOrEqual(15000);
    } finally {
      await tmp.cleanup();
    }
  });

  it("returns 0 for missing path (no-throw degrade)", () => {
    expect(getWorktreeAge("/definitely/does/not/exist")).toBe(0);
  });
});

describe("formatAge", () => {
  it("formats sub-minute as seconds", () => {
    expect(formatAge(45_000)).toBe("45s");
  });

  it("formats minutes when >= 60s", () => {
    expect(formatAge(5 * 60_000)).toBe("5m");
  });

  it("formats hours when >= 60m", () => {
    expect(formatAge(2 * 60 * 60_000)).toBe("2h");
  });

  it("formats days when >= 24h", () => {
    expect(formatAge(3 * 24 * 60 * 60_000)).toBe("3d");
  });

  it("rounds down to the largest fitting unit", () => {
    // 1.5 hours → 1h
    expect(formatAge(90 * 60_000)).toBe("1h");
  });
});
