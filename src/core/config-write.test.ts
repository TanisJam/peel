import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dir } from "tmp-promise";
import { afterEach, describe, expect, it } from "vitest";
import { parse as yamlParse } from "yaml";
import { DEFAULT_CONFIG } from "./config-defaults.js";
import { type Config, ConfigSchema } from "./config-schema.js";
import { pickNonDefault, writeConfig } from "./config-write.js";

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
  return d.path;
}

const customConfig = (): Config => ({
  ...DEFAULT_CONFIG,
  port: { base: 4200, strategy: "auto-find" },
  envFiles: [".env.local"],
  packageManager: "pnpm",
  commands: {
    install: "pnpm install",
    dev: "pnpm dev",
    build: "pnpm build",
    start: "pnpm start",
  },
});

describe("pickNonDefault", () => {
  it("returns nothing when input equals defaults", () => {
    expect(pickNonDefault(DEFAULT_CONFIG, DEFAULT_CONFIG)).toEqual({});
  });

  it("keeps only the differing fields", () => {
    const input: Config = { ...DEFAULT_CONFIG, packageManager: "pnpm" };
    expect(pickNonDefault(input, DEFAULT_CONFIG)).toEqual({
      packageManager: "pnpm",
    });
  });

  it("keeps full sub-object when any nested field differs", () => {
    const input: Config = {
      ...DEFAULT_CONFIG,
      port: { base: 4000, strategy: "fixed" },
    };
    const partial = pickNonDefault(input, DEFAULT_CONFIG);
    expect(partial).toEqual({ port: { base: 4000 } });
  });

  it("preserves arrays that differ from default", () => {
    const input: Config = { ...DEFAULT_CONFIG, envFiles: [".env.local"] };
    expect(pickNonDefault(input, DEFAULT_CONFIG)).toEqual({
      envFiles: [".env.local"],
    });
  });
});

describe("writeConfig", () => {
  it("writes a valid YAML file that round-trips through the schema", async () => {
    const cwd = await tmpRepo();
    const target = join(cwd, ".peel.yml");
    const cfg = customConfig();

    await writeConfig(cfg, target);

    const body = await readFile(target, "utf8");
    expect(body.endsWith("\n")).toBe(true);
    expect(body.endsWith("\n\n")).toBe(false);

    const parsed = ConfigSchema.parse({
      ...DEFAULT_CONFIG,
      ...(yamlParse(body) as object),
      commands: {
        ...DEFAULT_CONFIG.commands,
        ...((yamlParse(body) as { commands?: object }).commands ?? {}),
      },
    });
    expect(parsed.packageManager).toBe("pnpm");
    expect(parsed.port.strategy).toBe("auto-find");
  });

  it("omits fields equal to defaults (minimal output)", async () => {
    const cwd = await tmpRepo();
    const target = join(cwd, ".peel.yml");
    await writeConfig(DEFAULT_CONFIG, target);

    const body = await readFile(target, "utf8");
    expect(body.trim()).toBe("");
  });

  it("produces byte-identical output for identical inputs", async () => {
    const cwd = await tmpRepo();
    const cfg = customConfig();

    const a = join(cwd, "a.yml");
    const b = join(cwd, "b.yml");
    await writeConfig(cfg, a);
    await writeConfig(cfg, b);

    expect(await readFile(a, "utf8")).toBe(await readFile(b, "utf8"));
  });

  it("preserves the existing file if write is interrupted before rename", async () => {
    const cwd = await tmpRepo();
    const target = join(cwd, ".peel.yml");
    await writeFile(target, "untouched\n", "utf8");

    // Force a rename failure by passing an invalid target directory.
    const cfg = customConfig();
    await expect(writeConfig(cfg, join(cwd, "nope", "deep", ".peel.yml"))).rejects.toThrow();

    expect(await readFile(target, "utf8")).toBe("untouched\n");
  });
});
