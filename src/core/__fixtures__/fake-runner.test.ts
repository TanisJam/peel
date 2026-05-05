import { describe, expect, it } from "vitest";
import { FakeRunner } from "./fake-runner.js";

describe("FakeRunner.run", () => {
  it("returns scripted results in order and records calls", async () => {
    const r = new FakeRunner().scriptRun([
      { exitCode: 0, stdout: "hi", stderr: "" },
      { exitCode: 1, stdout: "", stderr: "boom" },
    ]);
    expect(await r.run({ command: "a", cwd: "/x" })).toEqual({
      exitCode: 0,
      stdout: "hi",
      stderr: "",
    });
    expect(await r.run({ command: "b", cwd: "/y" })).toEqual({
      exitCode: 1,
      stdout: "",
      stderr: "boom",
    });
    expect(r.runCalls).toEqual([
      { command: "a", cwd: "/x" },
      { command: "b", cwd: "/y" },
    ]);
  });

  it("throws when the script is exhausted", async () => {
    const r = new FakeRunner();
    await expect(r.run({ command: "x", cwd: "/" })).rejects.toThrow(/exhausted/);
  });
});

describe("FakeRunner.spawn", () => {
  it("returns a handle whose exited resolves with the scripted exit", async () => {
    const r = new FakeRunner().scriptSpawn([{ exit: { exitCode: 0, signal: null } }]);
    const h = r.spawn({ command: "dev", cwd: "/x" });
    expect(await h.exited).toEqual({ exitCode: 0, signal: null });
  });

  it("kill resolves a never-exiting child with the supplied signal", async () => {
    const r = new FakeRunner().scriptSpawn([{ neverExit: true }]);
    const h = r.spawn({ command: "dev", cwd: "/x" });
    h.kill("SIGINT");
    const exit = await h.exited;
    expect(exit.signal).toBe("SIGINT");
    expect(r.killSignals).toEqual(["SIGINT"]);
  });

  it("throws when the spawn script is exhausted", () => {
    const r = new FakeRunner();
    expect(() => r.spawn({ command: "x", cwd: "/" })).toThrow(/exhausted/);
  });
});
