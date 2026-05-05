import { describe, expect, it } from "vitest";
import { FakeRunner } from "./__fixtures__/fake-runner.js";
import { runHooks } from "./hooks.js";

describe("runHooks", () => {
  it("runs all hooks in order when each succeeds", async () => {
    const runner = new FakeRunner().scriptRun([
      { exitCode: 0, stdout: "", stderr: "" },
      { exitCode: 0, stdout: "", stderr: "" },
    ]);

    const result = await runHooks({
      runner,
      cwd: "/repo",
      hooks: ["pnpm prisma generate", "pnpm db:migrate"],
    });

    expect(result).toEqual({ ok: true });
    expect(runner.runCalls).toEqual([
      { command: "pnpm prisma generate", cwd: "/repo" },
      { command: "pnpm db:migrate", cwd: "/repo" },
    ]);
  });

  it("stops at first failure with index, command, and exit code", async () => {
    const runner = new FakeRunner().scriptRun([
      { exitCode: 0, stdout: "", stderr: "" },
      { exitCode: 2, stdout: "", stderr: "boom" },
    ]);

    const result = await runHooks({
      runner,
      cwd: "/repo",
      hooks: ["a", "b", "c"],
    });

    expect(result).toEqual({
      ok: false,
      failedAt: 1,
      command: "b",
      exitCode: 2,
    });
    expect(runner.runCalls).toHaveLength(2);
  });

  it("empty list is a no-op", async () => {
    const runner = new FakeRunner();
    const result = await runHooks({ runner, cwd: "/repo", hooks: [] });
    expect(result).toEqual({ ok: true });
    expect(runner.runCalls).toEqual([]);
  });
});
