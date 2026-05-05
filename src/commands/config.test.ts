import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dir } from "tmp-promise";
import { afterEach, describe, expect, it } from "vitest";
import { FakeRunner } from "../core/__fixtures__/fake-runner.js";
import { ConfigFlowError } from "../core/config-flow.js";
import { formatConfigFlowError, runConfigEdit, runConfigPath, runConfigShow } from "./config.js";

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

describe("runConfigShow", () => {
  it("returns exitCode:0 with merged YAML", async () => {
    const cwd = await tmpRepo();
    writeFileSync(join(cwd, ".peel.yml"), "port:\n  base: 4242\n");
    const result = await runConfigShow({ cwd });
    expect(result.exitCode).toBe(0);
    expect(result.message).toContain("4242");
    expect(result.message).toContain("install");
  });

  it("returns exitCode:1 with peel-init hint when missing", async () => {
    const cwd = await tmpRepo();
    const result = await runConfigShow({ cwd });
    expect(result.exitCode).toBe(1);
    expect(result.message?.toLowerCase()).toContain("peel init");
  });
});

describe("runConfigPath", () => {
  it("returns exitCode:0 + absolute path when present", async () => {
    const cwd = await tmpRepo();
    writeFileSync(join(cwd, ".peel.yml"), "");
    const result = await runConfigPath({ cwd });
    expect(result.exitCode).toBe(0);
    expect(result.message).toBe(join(cwd, ".peel.yml"));
  });

  it("returns exitCode:1 + would-be path when missing inside a repo", async () => {
    const cwd = await tmpRepo();
    const result = await runConfigPath({ cwd });
    expect(result.exitCode).toBe(1);
    expect(result.message).toBe(join(cwd, ".peel.yml"));
  });

  it("returns exitCode:1 with a friendly error outside a git repo", async () => {
    const cwd = (await dir({ unsafeCleanup: true })).path;
    cleanups.push(async () => {
      /* tmp lifecycle handled by dir */
    });
    const result = await runConfigPath({ cwd });
    expect(result.exitCode).toBe(1);
    expect(result.message?.toLowerCase()).toMatch(/git|peel init/);
  });
});

describe("runConfigEdit", () => {
  it("propagates editor exit code 0", async () => {
    const cwd = await tmpRepo();
    writeFileSync(join(cwd, ".peel.yml"), "");
    const runner = new FakeRunner().scriptSpawn([{ exit: { exitCode: 0, signal: null } }]);
    const result = await runConfigEdit({
      cwd,
      runner,
      env: { EDITOR: "vi" },
    });
    expect(result.exitCode).toBe(0);
  });

  it("returns exit:1 with no-editor message when neither VISUAL nor EDITOR set", async () => {
    const cwd = await tmpRepo();
    writeFileSync(join(cwd, ".peel.yml"), "");
    const runner = new FakeRunner();
    const result = await runConfigEdit({
      cwd,
      runner,
      env: {},
    });
    expect(result.exitCode).toBe(1);
    expect(result.message?.toUpperCase()).toContain("EDITOR");
  });

  it("returns exit:1 with peel-init hint when .peel.yml is missing", async () => {
    const cwd = await tmpRepo();
    const runner = new FakeRunner();
    const result = await runConfigEdit({
      cwd,
      runner,
      env: { EDITOR: "vi" },
    });
    expect(result.exitCode).toBe(1);
    expect(result.message?.toLowerCase()).toContain("peel init");
  });
});

describe("formatConfigFlowError", () => {
  it("returns the message verbatim for no-config", () => {
    const err = new ConfigFlowError("No .peel.yml found. Run `peel init` first.", "no-config");
    expect(formatConfigFlowError(err)).toContain("peel init");
  });

  it("returns the message verbatim for no-editor", () => {
    const err = new ConfigFlowError("No editor configured. Set $VISUAL or $EDITOR.", "no-editor");
    expect(formatConfigFlowError(err)).toContain("EDITOR");
  });
});
