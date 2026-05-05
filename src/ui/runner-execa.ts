import { execa } from "execa";
import type {
  RunArgs,
  RunResult,
  Runner,
  SpawnArgs,
  SpawnExit,
  SpawnHandle,
} from "../ports/runner.js";

export class ExecaRunner implements Runner {
  async run(args: RunArgs): Promise<RunResult> {
    const result = await execa(args.command, {
      cwd: args.cwd,
      shell: true,
      reject: false,
      ...(args.signal !== undefined ? { cancelSignal: args.signal } : {}),
    });
    return {
      exitCode: typeof result.exitCode === "number" ? result.exitCode : 1,
      stdout: typeof result.stdout === "string" ? result.stdout : "",
      stderr: typeof result.stderr === "string" ? result.stderr : "",
    };
  }

  spawn(args: SpawnArgs): SpawnHandle {
    const subprocess = execa(args.command, {
      cwd: args.cwd,
      shell: true,
      stdio: "inherit",
      reject: false,
    });

    const exited: Promise<SpawnExit> = subprocess.then(
      (r): SpawnExit => ({
        exitCode: typeof r.exitCode === "number" ? r.exitCode : null,
        signal: (r.signal as NodeJS.Signals | undefined) ?? null,
      }),
      (err: { exitCode?: unknown; signal?: unknown }): SpawnExit => ({
        exitCode: typeof err.exitCode === "number" ? err.exitCode : null,
        signal: (err.signal as NodeJS.Signals | undefined) ?? null,
      }),
    );

    return {
      exited,
      kill: (signal) => subprocess.kill(signal ?? "SIGTERM"),
    };
  }
}
