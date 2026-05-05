import { existsSync } from "node:fs";
import { join } from "node:path";
import { writeConfig } from "../core/config-write.js";
import { detectEnvFiles, detectPackageManager, detectScripts } from "../core/detect.js";
import { findGitRoot } from "../core/git.js";
import { type DetectedDefaults, buildConfigFromDetected, runWizard } from "../core/init-wizard.js";
import type { Prompter } from "../ports/prompter.js";

export class PeelInitError extends Error {
  constructor(
    message: string,
    public readonly kind: "not-in-git-repo" | "write-failed",
  ) {
    super(message);
    this.name = "PeelInitError";
  }
}

export type RunInitArgs = {
  cwd: string;
  prompter: Prompter;
  yes: boolean;
};

export async function runInitCommand(args: RunInitArgs): Promise<void> {
  const { cwd, prompter, yes } = args;

  if (findGitRoot(cwd) === null) {
    throw new PeelInitError(
      "peel init must run inside a git repository (no .git directory found in this path or any parent).",
      "not-in-git-repo",
    );
  }

  const detected: DetectedDefaults = {
    packageManager: detectPackageManager(cwd),
    envFiles: detectEnvFiles(cwd),
    scripts: detectScripts(cwd),
  };

  const target = join(cwd, ".peel.yml");
  const existingConfig = existsSync(target);

  if (yes) {
    const cfg = buildConfigFromDetected(detected);
    await writeConfig(cfg, target);
    return;
  }

  const cfg = await runWizard({ prompter, detected, existingConfig });
  if (cfg === null) return;
  await writeConfig(cfg, target);
}
