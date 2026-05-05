import type { Runner } from "../ports/runner.js";

export type HooksResult =
  | { ok: true }
  | { ok: false; failedAt: number; command: string; exitCode: number };

export type RunHooksArgs = {
  runner: Runner;
  cwd: string;
  hooks: string[];
};

export async function runHooks(args: RunHooksArgs): Promise<HooksResult> {
  for (let i = 0; i < args.hooks.length; i++) {
    const command = args.hooks[i];
    if (!command) continue;
    const result = await args.runner.run({ command, cwd: args.cwd });
    if (result.exitCode !== 0) {
      return {
        ok: false,
        failedAt: i,
        command,
        exitCode: result.exitCode,
      };
    }
  }
  return { ok: true };
}
