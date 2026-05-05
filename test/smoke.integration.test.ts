import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BINARY = resolve(process.cwd(), "dist/index.js");

describe("CLI binary smoke", () => {
  it("runs and prints the placeholder banner", () => {
    const result = spawnSync(process.execPath, [BINARY], {
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("coming soon");
  });
});
