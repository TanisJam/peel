import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BINARY = resolve(process.cwd(), "dist/index.js");

describe("CLI binary smoke", () => {
  it("runs and prints the default banner with version + getting-started hint", () => {
    const result = spawnSync(process.execPath, [BINARY], {
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    // Version line: "peel v<semver>"
    expect(result.stdout).toMatch(/peel v\d+\.\d+\.\d+/);
    // Getting-started pointer is what users actually need from this banner
    expect(result.stdout).toContain("peel init");
    expect(result.stdout).toContain("peel run");
  });
});
