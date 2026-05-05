import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Runner } from "../ports/runner.js";

export type InstallResult =
  | { ok: true; skipped?: true }
  | { ok: false; log: string; logPath: string };

export type RunInstallArgs = {
  runner: Runner;
  cwd: string;
  command: string;
  skipIfNodeModules?: boolean;
};

export async function runInstall(args: RunInstallArgs): Promise<InstallResult> {
  if (args.skipIfNodeModules && existsSync(join(args.cwd, "node_modules"))) {
    return { ok: true, skipped: true };
  }

  const result = await args.runner.run({
    command: args.command,
    cwd: args.cwd,
  });

  if (result.exitCode === 0) {
    return { ok: true };
  }

  const log = `${result.stdout}\n${result.stderr}`.trim();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_");
  const logPath = join(tmpdir(), `peel-install-${stamp}-${process.pid}.log`);
  await writeFile(logPath, log, { encoding: "utf8" });
  return { ok: false, log, logPath };
}
