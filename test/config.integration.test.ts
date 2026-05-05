import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type GitFixture, createGitFixture } from "../src/test-utils/git-fixture.js";

const BINARY = resolve(process.cwd(), "dist/index.js");

let fx: GitFixture;
beforeAll(async () => {
  fx = await createGitFixture();
});
afterAll(async () => {
  await fx.cleanup();
});

const peelCfg = `version: 1
port:
  base: 4242
  strategy: fixed
envFiles: []
packageManager: npm
commands:
  install: "npm install"
  dev: "npm run dev"
  build: "npm run build"
  start: "npm start"
preRun: []
worktree:
  baseDir: ".."
  prefix: ""
  autoCleanup: true
git:
  fetchOnStart: true
  includeRemoteBranches: true
  excludeBranches: []
`;

describe("peel config (integration)", () => {
  it("show prints merged YAML containing the user-set port.base", () => {
    writeFileSync(join(fx.repoRoot, ".peel.yml"), peelCfg);
    const result = spawnSync(process.execPath, [BINARY, "config", "show"], {
      cwd: fx.repoRoot,
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(
      result.status,
      `exit ${result.status}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    ).toBe(0);
    expect(result.stdout).toContain("4242");
    expect(result.stdout).toContain("install");
  });

  it("path prints the absolute config path with exit 0 when present", () => {
    writeFileSync(join(fx.repoRoot, ".peel.yml"), peelCfg);
    const result = spawnSync(process.execPath, [BINARY, "config", "path"], {
      cwd: fx.repoRoot,
      encoding: "utf8",
      timeout: 5_000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(join(fx.repoRoot, ".peel.yml"));
  });

  it("edit propagates the editor's exit code (fake editor exits 0)", () => {
    writeFileSync(join(fx.repoRoot, ".peel.yml"), peelCfg);
    const result = spawnSync(process.execPath, [BINARY, "config", "edit"], {
      cwd: fx.repoRoot,
      encoding: "utf8",
      timeout: 10_000,
      env: {
        ...process.env,
        EDITOR: `${process.execPath} -e "process.exit(0)"`,
      },
    });
    expect(
      result.status,
      `exit ${result.status}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    ).toBe(0);
  });

  it("edit fails with EDITOR hint when neither VISUAL nor EDITOR is set", () => {
    writeFileSync(join(fx.repoRoot, ".peel.yml"), peelCfg);
    const { VISUAL: _v, EDITOR: _e, ...env } = process.env;
    void _v;
    void _e;
    const result = spawnSync(process.execPath, [BINARY, "config", "edit"], {
      cwd: fx.repoRoot,
      encoding: "utf8",
      timeout: 5_000,
      env,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr.toUpperCase()).toContain("EDITOR");
  });
});
