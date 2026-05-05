import { describe, expect, it } from "vitest";
import { ConfigSchema, SCHEMA_VERSION } from "./config-schema.js";

describe("ConfigSchema", () => {
  const validConfig = {
    version: 1,
    port: { base: 3000, strategy: "fixed" as const },
    envFiles: [".env"],
    packageManager: "pnpm" as const,
    commands: {
      install: "pnpm install",
      dev: "pnpm dev",
      build: "pnpm build",
      start: "pnpm start",
    },
    preRun: [],
    worktree: { baseDir: "..", prefix: "", autoCleanup: true },
    git: {
      fetchOnStart: true,
      includeRemoteBranches: true,
      excludeBranches: [],
    },
  };

  it("parses a valid config", () => {
    const parsed = ConfigSchema.parse(validConfig);
    expect(parsed.version).toBe(1);
    expect(parsed.port.strategy).toBe("fixed");
    expect(parsed.commands.dev).toBe("pnpm dev");
  });

  it("rejects wrong types", () => {
    const bad = { ...validConfig, port: { base: "3000", strategy: "fixed" } };
    expect(() => ConfigSchema.parse(bad)).toThrow();
  });

  it("rejects unknown packageManager", () => {
    const bad = { ...validConfig, packageManager: "rush" };
    expect(() => ConfigSchema.parse(bad)).toThrow();
  });

  it("rejects unknown port strategy", () => {
    const bad = { ...validConfig, port: { base: 3000, strategy: "round-robin" } };
    expect(() => ConfigSchema.parse(bad)).toThrow();
  });

  it("rejects missing version", () => {
    const { version: _omit, ...rest } = validConfig;
    expect(() => ConfigSchema.parse(rest)).toThrow();
  });

  it("rejects unknown major schema version", () => {
    const bad = { ...validConfig, version: 2 };
    expect(() => ConfigSchema.parse(bad)).toThrow();
  });

  it("exposes SCHEMA_VERSION = 1", () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});
