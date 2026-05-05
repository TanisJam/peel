import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dir } from "tmp-promise";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config-defaults.js";
import { PeelConfigError, findConfigPath, loadConfig } from "./config-load.js";

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

describe("loadConfig", () => {
  it("reads .peel.yml from cwd and merges with defaults", async () => {
    const cwd = await tmpRepo();
    writeFileSync(join(cwd, ".peel.yml"), "packageManager: pnpm\n");

    const cfg = loadConfig(cwd);
    expect(cfg).not.toBeNull();
    expect(cfg?.packageManager).toBe("pnpm");
    expect(cfg?.port.base).toBe(DEFAULT_CONFIG.port.base);
    expect(cfg?.commands.dev).toBe(DEFAULT_CONFIG.commands.dev);
  });

  it("walks up to git root to find the config", async () => {
    const root = await tmpRepo();
    writeFileSync(join(root, ".peel.yml"), "packageManager: yarn\n");
    const sub = join(root, "packages", "app");
    mkdirSync(sub, { recursive: true });

    const cfg = loadConfig(sub);
    expect(cfg?.packageManager).toBe("yarn");
  });

  it("returns null when no .peel.yml exists between cwd and git root", async () => {
    const cwd = await tmpRepo();
    expect(loadConfig(cwd)).toBeNull();
  });

  it("array fields replace defaults (not concat)", async () => {
    const cwd = await tmpRepo();
    writeFileSync(join(cwd, ".peel.yml"), "envFiles:\n  - .env.local\n");

    const cfg = loadConfig(cwd);
    expect(cfg?.envFiles).toEqual([".env.local"]);
  });

  it("throws PeelConfigError(kind=schema-invalid) on bad value", async () => {
    const cwd = await tmpRepo();
    writeFileSync(join(cwd, ".peel.yml"), "port:\n  base: three-thousand\n  strategy: fixed\n");

    try {
      loadConfig(cwd);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(PeelConfigError);
      expect((err as PeelConfigError).kind).toBe("schema-invalid");
      expect((err as PeelConfigError).message).toMatch(/port/);
    }
  });

  it("throws PeelConfigError(kind=malformed-yaml) on bad YAML", async () => {
    const cwd = await tmpRepo();
    writeFileSync(join(cwd, ".peel.yml"), ": : :\n");

    try {
      loadConfig(cwd);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(PeelConfigError);
      expect((err as PeelConfigError).kind).toBe("malformed-yaml");
      expect((err as PeelConfigError).message).toContain(".peel.yml");
    }
  });
});

describe("findConfigPath", () => {
  it("returns the absolute path when .peel.yml is in cwd", async () => {
    const cwd = await tmpRepo();
    writeFileSync(join(cwd, ".peel.yml"), "");
    const result = findConfigPath(cwd);
    expect(result).toBe(join(cwd, ".peel.yml"));
  });

  it("walks up to the git root to find .peel.yml", async () => {
    const root = await tmpRepo();
    const sub = join(root, "packages", "ui");
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(root, ".peel.yml"), "");
    const result = findConfigPath(sub);
    expect(result).toBe(join(root, ".peel.yml"));
  });

  it("returns null when no .peel.yml is found", async () => {
    const cwd = await tmpRepo();
    expect(findConfigPath(cwd)).toBeNull();
  });
});
