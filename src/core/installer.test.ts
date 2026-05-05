import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dir } from "tmp-promise";
import { afterEach, describe, expect, it } from "vitest";
import { FakeRunner } from "./__fixtures__/fake-runner.js";
import { runInstall } from "./installer.js";

type Cleanup = () => Promise<void>;
const cleanups: Cleanup[] = [];
afterEach(async () => {
  while (cleanups.length) {
    const fn = cleanups.pop();
    if (fn) await fn();
  }
});

async function tmpDir(): Promise<string> {
  const d = await dir({ unsafeCleanup: true });
  cleanups.push(d.cleanup);
  return d.path;
}

describe("runInstall", () => {
  it("returns ok:true on exit code 0", async () => {
    const cwd = await tmpDir();
    const runner = new FakeRunner().scriptRun([
      { exitCode: 0, stdout: "added 100 packages\n", stderr: "" },
    ]);

    const result = await runInstall({
      runner,
      cwd,
      command: "npm install",
    });

    expect(result).toEqual({ ok: true });
    expect(runner.runCalls).toEqual([{ command: "npm install", cwd }]);
  });

  it("returns ok:false with combined log + persistent log file on failure", async () => {
    const cwd = await tmpDir();
    const runner = new FakeRunner().scriptRun([
      { exitCode: 1, stdout: "trying...\n", stderr: "ERR! pkg not found\n" },
    ]);

    const result = await runInstall({
      runner,
      cwd,
      command: "npm install",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.log).toContain("trying...");
      expect(result.log).toContain("ERR! pkg not found");
      expect(existsSync(result.logPath)).toBe(true);
      expect(readFileSync(result.logPath, "utf8")).toBe(result.log);
      cleanups.push(async () => {
        try {
          (await import("node:fs/promises")).unlink(result.logPath);
        } catch {
          /* noop */
        }
      });
    }
  });

  it("skipIfNodeModules: returns ok:true,skipped:true when node_modules exists, runner not called", async () => {
    const cwd = await tmpDir();
    mkdirSync(join(cwd, "node_modules"));
    const runner = new FakeRunner();

    const result = await runInstall({
      runner,
      cwd,
      command: "npm install",
      skipIfNodeModules: true,
    });

    expect(result).toEqual({ ok: true, skipped: true });
    expect(runner.runCalls).toEqual([]);
  });

  it("skipIfNodeModules: still runs when node_modules absent", async () => {
    const cwd = await tmpDir();
    const runner = new FakeRunner().scriptRun([{ exitCode: 0, stdout: "", stderr: "" }]);

    const result = await runInstall({
      runner,
      cwd,
      command: "npm install",
      skipIfNodeModules: true,
    });

    expect(result).toEqual({ ok: true });
    expect(runner.runCalls).toHaveLength(1);
  });
});
