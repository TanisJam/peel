import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCleanupHandler, installCleanupTrap } from "./cleanup.js";

describe("buildCleanupHandler", () => {
  it("removes the worktree by default", async () => {
    const removeWorktree = vi.fn().mockResolvedValue({ ok: true });
    const handler = buildCleanupHandler({
      removeWorktree,
      repoRoot: "/r",
      worktreePath: "/r-feature-x",
      keep: false,
    });

    await handler();

    expect(removeWorktree).toHaveBeenCalledTimes(1);
    expect(removeWorktree).toHaveBeenCalledWith("/r", "/r-feature-x");
  });

  it("--keep skips removal", async () => {
    const removeWorktree = vi.fn();
    const handler = buildCleanupHandler({
      removeWorktree,
      repoRoot: "/r",
      worktreePath: "/r-feature-x",
      keep: true,
    });

    await handler();

    expect(removeWorktree).not.toHaveBeenCalled();
  });

  it("is idempotent under repeated calls", async () => {
    const removeWorktree = vi.fn().mockResolvedValue({ ok: true });
    const handler = buildCleanupHandler({
      removeWorktree,
      repoRoot: "/r",
      worktreePath: "/r-feature-x",
      keep: false,
    });

    await Promise.all([handler(), handler(), handler()]);

    expect(removeWorktree).toHaveBeenCalledTimes(1);
  });
});

describe("installCleanupTrap", () => {
  let unregister: (() => void) | null = null;
  afterEach(() => {
    if (unregister) {
      unregister();
      unregister = null;
    }
  });

  it("unregister removes only the listeners it added", async () => {
    const beforeSigint = process.listeners("SIGINT").length;
    const beforeSigterm = process.listeners("SIGTERM").length;
    const beforeExit = process.listeners("exit").length;

    const handler = vi.fn(async () => {
      // noop
    });
    unregister = installCleanupTrap(handler);

    expect(process.listeners("SIGINT").length).toBe(beforeSigint + 1);
    expect(process.listeners("SIGTERM").length).toBe(beforeSigterm + 1);
    expect(process.listeners("exit").length).toBe(beforeExit + 1);

    unregister();
    unregister = null;

    expect(process.listeners("SIGINT").length).toBe(beforeSigint);
    expect(process.listeners("SIGTERM").length).toBe(beforeSigterm);
    expect(process.listeners("exit").length).toBe(beforeExit);
  });
});
