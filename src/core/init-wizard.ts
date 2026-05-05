import type { Prompter } from "../ports/prompter.js";
import { isCancel } from "../ports/prompter.js";
import { DEFAULT_CONFIG } from "./config-defaults.js";
import {
  type Config,
  type PackageManager,
  type PortStrategy,
  SCHEMA_VERSION,
} from "./config-schema.js";
import type { DetectedScripts } from "./detect.js";

export type DetectedDefaults = {
  packageManager: PackageManager;
  envFiles: string[];
  scripts: DetectedScripts;
};

const PM_INSTALL: Record<PackageManager, string> = {
  npm: "npm install",
  pnpm: "pnpm install",
  yarn: "yarn install",
  bun: "bun install",
};

function defaultDev(pm: PackageManager): string {
  return pm === "npm" ? "npm run dev" : `${pm} dev`;
}

function defaultBuild(pm: PackageManager): string {
  return pm === "npm" ? "npm run build" : `${pm} build`;
}

function defaultStart(pm: PackageManager): string {
  return pm === "npm" ? "npm start" : `${pm} start`;
}

export function buildConfigFromDetected(detected: DetectedDefaults): Config {
  const pm = detected.packageManager;
  return {
    ...DEFAULT_CONFIG,
    version: SCHEMA_VERSION,
    envFiles: [...detected.envFiles],
    packageManager: pm,
    commands: {
      install: PM_INSTALL[pm],
      dev: detected.scripts.dev ?? defaultDev(pm),
      build: detected.scripts.build ?? defaultBuild(pm),
      start: detected.scripts.start ?? defaultStart(pm),
    },
  };
}

export type RunWizardArgs = {
  prompter: Prompter;
  detected: DetectedDefaults;
  existingConfig: boolean;
};

const PORT_STRATEGY_OPTIONS: { value: PortStrategy; label: string }[] = [
  { value: "fixed", label: "fixed (fail if port is busy)" },
  { value: "auto-find", label: "auto-find (next free port from base)" },
];

const PM_OPTIONS: { value: PackageManager; label: string }[] = [
  { value: "npm", label: "npm" },
  { value: "pnpm", label: "pnpm" },
  { value: "yarn", label: "yarn" },
  { value: "bun", label: "bun" },
];

function parsePreRun(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parsePort(raw: string, fallback: number): number {
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function runWizard(args: RunWizardArgs): Promise<Config | null> {
  const { prompter, detected, existingConfig } = args;
  const seed = buildConfigFromDetected(detected);

  if (existingConfig) {
    const overwrite = await prompter.confirm({
      message: ".peel.yml already exists. Overwrite?",
      initialValue: false,
    });
    if (isCancel(overwrite) || overwrite === false) return null;
  }

  const strategy = await prompter.select({
    message: "Port strategy?",
    options: PORT_STRATEGY_OPTIONS,
    initialValue: seed.port.strategy,
  });
  if (isCancel(strategy)) return null;

  const portRaw = await prompter.text({
    message: "Base port",
    defaultValue: String(seed.port.base),
  });
  if (isCancel(portRaw)) return null;
  const port = parsePort(portRaw, seed.port.base);

  let envFiles: string[] = [];
  if (detected.envFiles.length > 0) {
    const picked = await prompter.multiselect({
      message: "Env files to copy into the worktree",
      options: detected.envFiles.map((f) => ({ value: f, label: f })),
      initialValues: detected.envFiles,
      required: false,
    });
    if (isCancel(picked)) return null;
    envFiles = picked;
  }

  const pm = await prompter.select({
    message: "Package manager",
    options: PM_OPTIONS,
    initialValue: seed.packageManager,
  });
  if (isCancel(pm)) return null;

  const install = await prompter.text({
    message: "Install command",
    defaultValue: PM_INSTALL[pm],
  });
  if (isCancel(install)) return null;

  const dev = await prompter.text({
    message: "Dev command",
    defaultValue: detected.scripts.dev ?? defaultDev(pm),
  });
  if (isCancel(dev)) return null;

  const build = await prompter.text({
    message: "Build command",
    defaultValue: detected.scripts.build ?? defaultBuild(pm),
  });
  if (isCancel(build)) return null;

  const start = await prompter.text({
    message: "Start command",
    defaultValue: detected.scripts.start ?? defaultStart(pm),
  });
  if (isCancel(start)) return null;

  const preRunRaw = await prompter.text({
    message: "Pre-run hooks (one per line, leave empty for none)",
    defaultValue: "",
  });
  if (isCancel(preRunRaw)) return null;

  const baseDir = await prompter.text({
    message: "Worktree base directory (relative to repo)",
    defaultValue: seed.worktree.baseDir,
  });
  if (isCancel(baseDir)) return null;

  const autoCleanup = await prompter.confirm({
    message: "Auto-cleanup worktree on exit?",
    initialValue: seed.worktree.autoCleanup,
  });
  if (isCancel(autoCleanup)) return null;

  return {
    ...seed,
    port: { base: port, strategy },
    envFiles,
    packageManager: pm,
    commands: { install, dev, build, start },
    preRun: parsePreRun(preRunRaw),
    worktree: { ...seed.worktree, baseDir, autoCleanup },
  };
}
