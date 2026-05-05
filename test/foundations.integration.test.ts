import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../src/core/config-load.js";
import { gitFetch, listBranches } from "../src/core/git.js";
import { findFreePort } from "../src/core/port.js";
import { createWorktree, listWorktrees, removeWorktree } from "../src/core/worktree.js";
import { type GitFixture, createGitFixture } from "../src/test-utils/git-fixture.js";

let fx: GitFixture;
beforeAll(async () => {
  fx = await createGitFixture();
});
afterAll(async () => {
  await fx.cleanup();
});

describe("foundations integration", () => {
  it("composes loadConfig + gitFetch + listBranches + worktree round-trip + findFreePort", async () => {
    // 1. loadConfig: fixture has no .peel.yml → null
    expect(loadConfig(fx.repoRoot)).toBeNull();

    // 2. gitFetch: fixture origin is local file:// — must succeed
    const fetched = await gitFetch(fx.repoRoot);
    expect(fetched).toEqual({ ok: true });

    // 3. listBranches: at least main + feature/x
    const branches = await listBranches(fx.repoRoot);
    const names = branches.map((b) => b.name);
    expect(names).toContain("main");
    expect(names).toContain("feature/x");

    // 4. Create a worktree for feature/x
    const path = join(fx.repoRoot, "..", `${fx.repoRoot.split("/").pop()}-feature-x`);
    await createWorktree({ repoRoot: fx.repoRoot, path, branch: "feature/x" });
    expect(existsSync(path)).toBe(true);

    // 5. listWorktrees should now include both
    const wts = await listWorktrees(fx.repoRoot);
    expect(wts.find((w) => w.path === fx.repoRoot)).toBeDefined();
    expect(wts.find((w) => w.path === path)).toBeDefined();

    // 6. removeWorktree cleans up
    const removed = await removeWorktree(fx.repoRoot, path);
    expect(removed.ok).toBe(true);
    expect(existsSync(path)).toBe(false);

    // 7. findFreePort produces a real available port within range
    const port = await findFreePort(40_000, 200);
    expect(port).not.toBeNull();
    expect(port).toBeGreaterThanOrEqual(40_000);
  });
});
