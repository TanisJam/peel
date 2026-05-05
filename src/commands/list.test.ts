import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { dir } from "tmp-promise";
import { afterEach, describe, expect, it } from "vitest";
import { ListFlowError } from "../core/list-flow.js";
import { formatListFlowError } from "./list.js";

type Cleanup = () => Promise<void>;
const cleanups: Cleanup[] = [];
afterEach(async () => {
  while (cleanups.length) {
    const fn = cleanups.pop();
    if (fn) await fn();
  }
});

async function tmpRepo(): Promise<string> {
  const d = await dir({ unsafeCleanup: true });
  cleanups.push(d.cleanup);
  mkdirSync(join(d.path, ".git"));
  return d.path;
}

describe("formatListFlowError", () => {
  it("returns the error message verbatim for no-config", () => {
    const err = new ListFlowError("No .peel.yml found. Run `peel init` first.", "no-config");
    expect(formatListFlowError(err)).toContain("peel init");
  });
});

// Smoke test for the wrapper itself: invoking runListCommand in a directory
// that is not a git repo MUST return exitCode 1 with the init hint.
describe("runListCommand", () => {
  it("returns exitCode:1 with a peel-init hint outside a git repo", async () => {
    const repoRoot = await tmpRepo();
    // Remove .git to simulate non-repo
    const { runListCommand } = await import("./list.js");
    const noRepo = await dir({ unsafeCleanup: true });
    cleanups.push(noRepo.cleanup);
    const result = await runListCommand({ cwd: noRepo.path });
    expect(result.exitCode).toBe(1);
    expect(result.message?.toLowerCase()).toContain("peel init");
    void repoRoot;
  });
});
