import { existsSync } from "node:fs";
import { join } from "node:path";
import { writeConfig } from "../core/config-write.js";
import { detectEnvFiles, detectPackageManager, detectScripts } from "../core/detect.js";
import { findGitRoot } from "../core/git.js";
import { type DetectedDefaults, buildConfigFromDetected, runWizard } from "../core/init-wizard.js";
import type { Prompter } from "../ports/prompter.js";

export type InitInvocation = "global" | "npx";

export function detectInitInvocation(env: NodeJS.ProcessEnv = process.env): InitInvocation {
  // npm/npx set npm_execpath; with `npx` the npm_command is "exec".
  // Best-effort heuristic — falls back to "global" when ambiguous so users
  // installed globally see the friendlier `peel ...` form.
  if (env.npm_command === "exec" || env.npm_lifecycle_event === "npx") return "npx";
  return "global";
}

export function nextStepsMessage(invocation: InitInvocation): string {
  const lines: string[] = ["Wrote .peel.yml — peel is ready.", "", "Next steps:"];
  if (invocation === "npx") {
    lines.push("  npx @tanisjam/peel run feature/x dev   # one-off");
    lines.push("");
    lines.push("Or install globally for a shorter command:");
    lines.push("  npm install -g @tanisjam/peel");
    lines.push("  peel run feature/x dev");
  } else {
    lines.push("  peel run feature/x dev   # spin up an isolated worktree");
    lines.push("  peel run                 # interactive: pick branch + mode");
    lines.push("  peel list                # show active worktrees");
    lines.push("");
    lines.push("Tip: if you see `command not found: peel`, install globally:");
    lines.push("  npm install -g @tanisjam/peel");
  }
  return lines.join("\n");
}

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
