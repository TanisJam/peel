import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config-defaults.js";
import { ConfigSchema, SCHEMA_VERSION } from "./config-schema.js";

describe("DEFAULT_CONFIG", () => {
  it("parses against the schema", () => {
    expect(() => ConfigSchema.parse(DEFAULT_CONFIG)).not.toThrow();
  });

  it("uses the current schema version", () => {
    expect(DEFAULT_CONFIG.version).toBe(SCHEMA_VERSION);
  });

  it("defaults to npm + port 3000 + auto-cleanup on", () => {
    expect(DEFAULT_CONFIG.packageManager).toBe("npm");
    expect(DEFAULT_CONFIG.port.base).toBe(3000);
    expect(DEFAULT_CONFIG.port.strategy).toBe("fixed");
    expect(DEFAULT_CONFIG.worktree.autoCleanup).toBe(true);
  });

  it("has empty arrays for optional collections", () => {
    expect(DEFAULT_CONFIG.envFiles).toEqual([]);
    expect(DEFAULT_CONFIG.preRun).toEqual([]);
    expect(DEFAULT_CONFIG.git.excludeBranches).toEqual([]);
  });
});
