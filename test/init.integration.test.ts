import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { dir } from "tmp-promise";
import { afterEach, describe, expect, it } from "vitest";
import { parse as yamlParse } from "yaml";
import { DEFAULT_CONFIG } from "../src/core/config-defaults.js";
import { ConfigSchema } from "../src/core/config-schema.js";

const BINARY = resolve(process.cwd(), "dist/index.js");

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

describe("peel init (integration)", () => {
  it("--yes writes a schema-valid .peel.yml in a fresh repo", async () => {
    const cwd = await tmpRepo();
    mkdirSync(join(cwd, ".git"));
    writeFileSync(join(cwd, "pnpm-lock.yaml"), "");
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify({ scripts: { dev: "vite", build: "vite build" } }),
    );

    const result = spawnSync(process.execPath, [BINARY, "init", "--yes"], {
      cwd,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);

    const body = readFileSync(join(cwd, ".peel.yml"), "utf8");
    const partial = (yamlParse(body) as object | null) ?? {};
    const merged = {
      ...DEFAULT_CONFIG,
      ...partial,
      commands: {
        ...DEFAULT_CONFIG.commands,
        ...((partial as { commands?: object }).commands ?? {}),
      },
    };
    const cfg = ConfigSchema.parse(merged);
    expect(cfg.packageManager).toBe("pnpm");
    expect(cfg.commands.dev).toBe("vite");
    expect(cfg.commands.build).toBe("vite build");
  });

  it("exits non-zero outside a git repo with a friendly message", async () => {
    const cwd = await tmpRepo();
    const result = spawnSync(process.execPath, [BINARY, "init", "--yes"], {
      cwd,
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    const combined = `${result.stdout}${result.stderr}`;
    expect(combined.toLowerCase()).toContain("git");
  });
});
