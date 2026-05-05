import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dir } from "tmp-promise";
import { afterEach, describe, expect, it } from "vitest";
import { parse as yamlParse } from "yaml";
import { FakeRunner } from "./__fixtures__/fake-runner.js";
import {
  ConfigFlowError,
  type ConfigFlowOps,
  configPath,
  editConfig,
  showConfig,
} from "./config-flow.js";
import { findConfigPath, loadConfig } from "./config-load.js";
import { findGitRoot } from "./git.js";

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

const realOps: ConfigFlowOps = {
  loadConfig,
  findGitRoot,
  findConfigPath,
};

describe("showConfig", () => {
  it("returns YAML containing user-set values and defaults; round-trips through loadConfig", async () => {
    const cwd = await tmpRepo();
    writeFileSync(join(cwd, ".peel.yml"), "port:\n  base: 4242\n");

    const yaml = showConfig({ cwd, ops: realOps });
    expect(yaml).toContain("4242");
    // Defaults are present
    expect(yaml).toContain("install");
    expect(yaml).toContain("baseDir");

    // Output is parseable as YAML
    const parsed = yamlParse(yaml) as { port: { base: number } };
    expect(parsed.port.base).toBe(4242);
  });

  it("throws ConfigFlowError(no-config) when .peel.yml is missing", async () => {
    const cwd = await tmpRepo();
    expect(() => showConfig({ cwd, ops: realOps })).toThrowError(ConfigFlowError);
  });
});

describe("configPath", () => {
  it("reports the absolute path and exists:true when .peel.yml is present", async () => {
    const cwd = await tmpRepo();
    writeFileSync(join(cwd, ".peel.yml"), "");

    const result = configPath({ cwd, ops: realOps });
    expect(result.exists).toBe(true);
    expect(result.path).toBe(join(cwd, ".peel.yml"));
  });

  it("reports the would-be path and exists:false when missing inside a git repo", async () => {
    const cwd = await tmpRepo();
    const result = configPath({ cwd, ops: realOps });
    expect(result.exists).toBe(false);
    expect(result.path).toBe(join(cwd, ".peel.yml"));
  });

  it("throws ConfigFlowError(no-git) when not inside any git repo", async () => {
    const cwd = (await dir({ unsafeCleanup: true })).path;
    expect(() => configPath({ cwd, ops: realOps })).toThrowError(ConfigFlowError);
  });
});

describe("editConfig", () => {
  it("spawns the editor with the absolute config path and propagates exit 0", async () => {
    const cwd = await tmpRepo();
    writeFileSync(join(cwd, ".peel.yml"), "");
    const runner = new FakeRunner().scriptSpawn([{ exit: { exitCode: 0, signal: null } }]);
    const result = await editConfig({
      cwd,
      ops: realOps,
      runner,
      env: { EDITOR: "vi" },
    });
    expect(result.exitCode).toBe(0);
    expect(runner.spawnCalls).toHaveLength(1);
    expect(runner.spawnCalls[0]?.command).toContain("vi ");
    expect(runner.spawnCalls[0]?.command).toContain(`"${join(cwd, ".peel.yml")}"`);
  });

  it("propagates non-zero editor exit code", async () => {
    const cwd = await tmpRepo();
    writeFileSync(join(cwd, ".peel.yml"), "");
    const runner = new FakeRunner().scriptSpawn([{ exit: { exitCode: 7, signal: null } }]);
    const result = await editConfig({
      cwd,
      ops: realOps,
      runner,
      env: { EDITOR: "vi" },
    });
    expect(result.exitCode).toBe(7);
  });

  it("prefers $VISUAL over $EDITOR when both set", async () => {
    const cwd = await tmpRepo();
    writeFileSync(join(cwd, ".peel.yml"), "");
    const runner = new FakeRunner().scriptSpawn([{ exit: { exitCode: 0, signal: null } }]);
    await editConfig({
      cwd,
      ops: realOps,
      runner,
      env: { VISUAL: "code", EDITOR: "vi" },
    });
    expect(runner.spawnCalls[0]?.command).toContain("code ");
    expect(runner.spawnCalls[0]?.command).not.toContain("vi ");
  });

  it("throws ConfigFlowError(no-editor) when neither VISUAL nor EDITOR is set", async () => {
    const cwd = await tmpRepo();
    writeFileSync(join(cwd, ".peel.yml"), "");
    const runner = new FakeRunner();
    await expect(editConfig({ cwd, ops: realOps, runner, env: {} })).rejects.toMatchObject({
      name: "ConfigFlowError",
      kind: "no-editor",
    });
    expect(runner.spawnCalls).toHaveLength(0);
  });

  it("throws ConfigFlowError(no-config) when .peel.yml is missing; does not spawn", async () => {
    const cwd = await tmpRepo();
    const runner = new FakeRunner();
    await expect(
      editConfig({ cwd, ops: realOps, runner, env: { EDITOR: "vi" } }),
    ).rejects.toMatchObject({ name: "ConfigFlowError", kind: "no-config" });
    expect(runner.spawnCalls).toHaveLength(0);
  });
});
