import { dir } from "tmp-promise";
import { afterEach, describe, expect, it } from "vitest";
import { FakePrompter } from "../core/__fixtures__/fake-prompter.js";
import { CleanFlowError } from "../core/clean-flow.js";
import { formatCleanFlowError } from "./clean.js";

type Cleanup = () => Promise<void>;
const cleanups: Cleanup[] = [];
afterEach(async () => {
  while (cleanups.length) {
    const fn = cleanups.pop();
    if (fn) await fn();
  }
});

describe("formatCleanFlowError", () => {
  it("formats branch-not-found with the branch name", () => {
    const err = new CleanFlowError(
      "Branch 'gone' is not a peel-managed worktree",
      "branch-not-found",
      { name: "gone" },
    );
    const out = formatCleanFlowError(err);
    expect(out).toContain("gone");
  });

  it("returns the no-config message verbatim", () => {
    const err = new CleanFlowError("No .peel.yml found. Run `peel init` first.", "no-config");
    expect(formatCleanFlowError(err)).toContain("peel init");
  });
});

describe("runCleanCommand", () => {
  it("returns exitCode:1 with a peel-init hint outside a git repo", async () => {
    const noRepo = await dir({ unsafeCleanup: true });
    cleanups.push(noRepo.cleanup);
    const { runCleanCommand } = await import("./clean.js");
    const result = await runCleanCommand({
      cwd: noRepo.path,
      prompter: new FakePrompter(),
      mode: "all",
      yes: true,
      noFetch: false,
    });
    expect(result.exitCode).toBe(1);
    expect(result.message?.toLowerCase()).toContain("peel init");
  });
});
