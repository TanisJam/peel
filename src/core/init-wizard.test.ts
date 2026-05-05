import { describe, expect, it } from "vitest";
import { CANCEL } from "../ports/prompter.js";
import { FakePrompter, type ScriptStep } from "./__fixtures__/fake-prompter.js";
import { ConfigSchema } from "./config-schema.js";
import { type DetectedDefaults, buildConfigFromDetected, runWizard } from "./init-wizard.js";

const detected: DetectedDefaults = {
  packageManager: "pnpm",
  envFiles: [".env.local"],
  scripts: { dev: "next dev", build: "next build", start: "next start" },
};

const happyPathScript: ScriptStep[] = [
  { kind: "select", value: "auto-find" }, // port strategy
  { kind: "text", value: "4200" }, // base port
  { kind: "multiselect", value: [".env.local"] }, // env files
  { kind: "select", value: "pnpm" }, // package manager
  { kind: "text", value: "pnpm install" }, // install
  { kind: "text", value: "pnpm dev" }, // dev
  { kind: "text", value: "pnpm build" }, // build
  { kind: "text", value: "pnpm start" }, // start
  { kind: "text", value: "" }, // pre-run hooks (none)
  { kind: "text", value: ".." }, // worktree base
  { kind: "confirm", value: true }, // auto-cleanup
];

describe("buildConfigFromDetected", () => {
  it("produces a schema-valid Config from detected values + defaults", () => {
    const cfg = buildConfigFromDetected(detected);
    expect(() => ConfigSchema.parse(cfg)).not.toThrow();
    expect(cfg.packageManager).toBe("pnpm");
    expect(cfg.envFiles).toEqual([".env.local"]);
    expect(cfg.commands.dev).toBe("next dev");
  });

  it("falls back to npm-style defaults when scripts are missing", () => {
    const cfg = buildConfigFromDetected({
      packageManager: "npm",
      envFiles: [],
      scripts: { dev: null, build: null, start: null },
    });
    expect(cfg.commands.dev).toBe("npm run dev");
    expect(cfg.commands.build).toBe("npm run build");
    expect(cfg.commands.start).toBe("npm start");
  });
});

describe("runWizard", () => {
  it("returns a schema-valid Config from scripted happy-path answers", async () => {
    const prompter = new FakePrompter().script(happyPathScript);
    const cfg = await runWizard({ prompter, detected, existingConfig: false });

    expect(cfg).not.toBeNull();
    if (!cfg) throw new Error("wizard returned null");

    expect(() => ConfigSchema.parse(cfg)).not.toThrow();
    expect(cfg.port).toEqual({ base: 4200, strategy: "auto-find" });
    expect(cfg.envFiles).toEqual([".env.local"]);
    expect(cfg.packageManager).toBe("pnpm");
    expect(cfg.commands.dev).toBe("pnpm dev");
    expect(cfg.preRun).toEqual([]);
    expect(cfg.worktree.autoCleanup).toBe(true);
  });

  it("returns null when the user cancels mid-flow", async () => {
    const cancelAtThird: ScriptStep[] = [
      { kind: "select", value: "fixed" },
      { kind: "text", value: "3000" },
      { kind: "multiselect", value: CANCEL },
    ];
    const prompter = new FakePrompter().script(cancelAtThird);
    const cfg = await runWizard({ prompter, detected, existingConfig: false });
    expect(cfg).toBeNull();
  });

  it("asks for overwrite confirmation first when existingConfig is true", async () => {
    const prompter = new FakePrompter().script([
      { kind: "confirm", value: false }, // refuse overwrite
    ]);
    const cfg = await runWizard({ prompter, detected, existingConfig: true });
    expect(cfg).toBeNull();
    expect(prompter.transcript[0]?.kind).toBe("confirm");
  });

  it("continues into the wizard after confirming overwrite", async () => {
    const prompter = new FakePrompter().script([
      { kind: "confirm", value: true },
      ...happyPathScript,
    ]);
    const cfg = await runWizard({ prompter, detected, existingConfig: true });
    expect(cfg).not.toBeNull();
  });

  it("parses a numeric base port from text input", async () => {
    const prompter = new FakePrompter().script(happyPathScript);
    const cfg = await runWizard({ prompter, detected, existingConfig: false });
    expect(cfg?.port.base).toBe(4200);
  });

  it("treats whitespace pre-run input as an empty list", async () => {
    const prompter = new FakePrompter().script([
      ...happyPathScript.slice(0, 8),
      { kind: "text", value: "   " }, // whitespace only
      { kind: "text", value: ".." },
      { kind: "confirm", value: true },
    ]);
    const cfg = await runWizard({ prompter, detected, existingConfig: false });
    expect(cfg?.preRun).toEqual([]);
  });

  it("splits multi-line pre-run input into list entries", async () => {
    const prompter = new FakePrompter().script([
      ...happyPathScript.slice(0, 8),
      { kind: "text", value: "pnpm prisma generate\npnpm db:migrate" },
      { kind: "text", value: ".." },
      { kind: "confirm", value: true },
    ]);
    const cfg = await runWizard({ prompter, detected, existingConfig: false });
    expect(cfg?.preRun).toEqual(["pnpm prisma generate", "pnpm db:migrate"]);
  });
});
