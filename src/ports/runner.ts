export type RunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type SpawnExit = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
};

export type SpawnHandle = {
  exited: Promise<SpawnExit>;
  kill(signal?: NodeJS.Signals): boolean;
};

export type RunArgs = {
  command: string;
  cwd: string;
  signal?: AbortSignal;
};

export type SpawnArgs = {
  command: string;
  cwd: string;
};

export interface Runner {
  run(args: RunArgs): Promise<RunResult>;
  spawn(args: SpawnArgs): SpawnHandle;
}
