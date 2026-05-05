import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dir } from "tmp-promise";
import { afterEach, describe, expect, it } from "vitest";
import { copyEnvFiles } from "./env-copy.js";

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

describe("copyEnvFiles", () => {
  it("copies present, skips existing, reports missing", async () => {
    const src = await tmpDir();
    const dest = await tmpDir();

    writeFileSync(join(src, ".env"), "SRC_ENV=1\n");
    writeFileSync(join(src, ".env.local"), "SRC_LOCAL=2\n");
    writeFileSync(join(dest, ".env.local"), "DEST_LOCAL=keep\n");

    const result = await copyEnvFiles({
      src,
      dest,
      files: [".env", ".env.local", ".env.test"],
    });

    expect(result).toEqual({
      copied: [".env"],
      skipped: [".env.local"],
      missing: [".env.test"],
    });
    expect(readFileSync(join(dest, ".env"), "utf8")).toBe("SRC_ENV=1\n");
    // Existing destination file is untouched
    expect(readFileSync(join(dest, ".env.local"), "utf8")).toBe("DEST_LOCAL=keep\n");
  });

  it("empty list is a no-op", async () => {
    const src = await tmpDir();
    const dest = await tmpDir();

    const result = await copyEnvFiles({ src, dest, files: [] });
    expect(result).toEqual({ copied: [], skipped: [], missing: [] });
    expect(existsSync(join(dest, ".env"))).toBe(false);
  });
});
