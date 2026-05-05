import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dir } from "tmp-promise";
import { afterEach, describe, expect, it } from "vitest";
import { detectEnvFiles, detectPackageManager, detectScripts } from "./detect.js";

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

describe("detectPackageManager", () => {
  it("respects Corepack `packageManager` over lockfiles", async () => {
    const cwd = await tmpRepo();
    await writeFile(join(cwd, "pnpm-lock.yaml"), "");
    await writeFile(join(cwd, "package.json"), JSON.stringify({ packageManager: "yarn@4.0.0" }));
    expect(detectPackageManager(cwd)).toBe("yarn");
  });

  it("picks pnpm when both pnpm and npm lockfiles exist", async () => {
    const cwd = await tmpRepo();
    await writeFile(join(cwd, "pnpm-lock.yaml"), "");
    await writeFile(join(cwd, "package-lock.json"), "{}");
    expect(detectPackageManager(cwd)).toBe("pnpm");
  });

  it("picks bun when bun.lock is present", async () => {
    const cwd = await tmpRepo();
    await writeFile(join(cwd, "bun.lock"), "");
    expect(detectPackageManager(cwd)).toBe("bun");
  });

  it("picks yarn over npm", async () => {
    const cwd = await tmpRepo();
    await writeFile(join(cwd, "yarn.lock"), "");
    await writeFile(join(cwd, "package-lock.json"), "{}");
    expect(detectPackageManager(cwd)).toBe("yarn");
  });

  it("defaults to npm when no signal exists", async () => {
    const cwd = await tmpRepo();
    expect(detectPackageManager(cwd)).toBe("npm");
  });

  it("ignores invalid Corepack value and falls back to lockfile sniff", async () => {
    const cwd = await tmpRepo();
    await writeFile(join(cwd, "pnpm-lock.yaml"), "");
    await writeFile(join(cwd, "package.json"), JSON.stringify({ packageManager: "rush@1.0.0" }));
    expect(detectPackageManager(cwd)).toBe("pnpm");
  });
});

describe("detectEnvFiles", () => {
  it("includes loadable env files and excludes templates", async () => {
    const cwd = await tmpRepo();
    await writeFile(join(cwd, ".env"), "");
    await writeFile(join(cwd, ".env.local"), "");
    await writeFile(join(cwd, ".env.example"), "");
    await writeFile(join(cwd, ".env.production.sample"), "");
    expect(detectEnvFiles(cwd)).toEqual([".env", ".env.local"]);
  });

  it("returns an empty list when no env files exist", async () => {
    const cwd = await tmpRepo();
    expect(detectEnvFiles(cwd)).toEqual([]);
  });

  it("returns alphabetically sorted output", async () => {
    const cwd = await tmpRepo();
    await writeFile(join(cwd, ".env.test"), "");
    await writeFile(join(cwd, ".env"), "");
    await writeFile(join(cwd, ".env.local"), "");
    expect(detectEnvFiles(cwd)).toEqual([".env", ".env.local", ".env.test"]);
  });
});

describe("detectScripts", () => {
  it("returns dev/build/start when present", async () => {
    const cwd = await tmpRepo();
    await writeFile(
      join(cwd, "package.json"),
      JSON.stringify({
        scripts: { dev: "next dev", build: "next build", start: "next start" },
      }),
    );
    expect(detectScripts(cwd)).toEqual({
      dev: "next dev",
      build: "next build",
      start: "next start",
    });
  });

  it("returns null for missing scripts", async () => {
    const cwd = await tmpRepo();
    await writeFile(join(cwd, "package.json"), JSON.stringify({ scripts: { dev: "vite" } }));
    expect(detectScripts(cwd)).toEqual({
      dev: "vite",
      build: null,
      start: null,
    });
  });

  it("returns all-null without throwing when package.json is missing", async () => {
    const cwd = await tmpRepo();
    expect(detectScripts(cwd)).toEqual({
      dev: null,
      build: null,
      start: null,
    });
  });

  it("returns all-null without throwing when package.json is malformed", async () => {
    const cwd = await tmpRepo();
    await writeFile(join(cwd, "package.json"), "not json {");
    expect(detectScripts(cwd)).toEqual({
      dev: null,
      build: null,
      start: null,
    });
  });
});
