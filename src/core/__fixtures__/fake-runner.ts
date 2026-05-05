import type {
  RunArgs,
  RunResult,
  Runner,
  SpawnArgs,
  SpawnExit,
  SpawnHandle,
} from "../../ports/runner.js";

export type RunCall = { command: string; cwd: string };
export type SpawnCall = { command: string; cwd: string };

export type ScriptedSpawn = { exit: SpawnExit; afterMs?: number } | { neverExit: true };

export class FakeRunner implements Runner {
  private runScript: RunResult[] = [];
  private spawnScript: ScriptedSpawn[] = [];
  public readonly runCalls: RunCall[] = [];
  public readonly spawnCalls: SpawnCall[] = [];
  public readonly killSignals: (NodeJS.Signals | undefined)[] = [];

  scriptRun(results: RunResult[]): this {
    this.runScript = [...results];
    return this;
  }

  scriptSpawn(handles: ScriptedSpawn[]): this {
    this.spawnScript = [...handles];
    return this;
  }

  async run(args: RunArgs): Promise<RunResult> {
    this.runCalls.push({ command: args.command, cwd: args.cwd });
    const next = this.runScript.shift();
    if (!next) {
      throw new Error(`FakeRunner.run script exhausted (no result for command: "${args.command}")`);
    }
    return next;
  }

  spawn(args: SpawnArgs): SpawnHandle {
    this.spawnCalls.push({ command: args.command, cwd: args.cwd });
    const next = this.spawnScript.shift();
    if (!next) {
      throw new Error(
        `FakeRunner.spawn script exhausted (no handle for command: "${args.command}")`,
      );
    }

    let resolveExit: (value: SpawnExit) => void = () => {};
    const exited = new Promise<SpawnExit>((resolve) => {
      resolveExit = resolve;
    });

    if ("neverExit" in next && next.neverExit) {
      // Resolves only when kill() is called below
    } else if ("exit" in next) {
      const exit = next.exit;
      if (next.afterMs && next.afterMs > 0) {
        setTimeout(() => resolveExit(exit), next.afterMs);
      } else {
        // Resolve on next microtask so callers can await deterministically.
        queueMicrotask(() => resolveExit(exit));
      }
    }

    const handle: SpawnHandle = {
      exited,
      kill: (signal) => {
        this.killSignals.push(signal);
        resolveExit({ exitCode: null, signal: signal ?? "SIGTERM" });
        return true;
      },
    };
    return handle;
  }
}
