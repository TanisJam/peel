export type RemoveWorktreeFn = (repoRoot: string, worktreePath: string) => Promise<unknown>;

export type Logger = {
  info?: (message: string) => void;
  warn?: (message: string) => void;
};

export type CleanupDeps = {
  removeWorktree: RemoveWorktreeFn;
  repoRoot: string;
  worktreePath: string;
  keep: boolean;
  logger?: Logger;
};

export function buildCleanupHandler(deps: CleanupDeps): () => Promise<void> {
  let started: Promise<void> | null = null;
  return () => {
    if (started) return started;
    started = (async () => {
      if (deps.keep) {
        deps.logger?.info?.(`--keep set; preserving ${deps.worktreePath}`);
        return;
      }
      try {
        await deps.removeWorktree(deps.repoRoot, deps.worktreePath);
      } catch (err) {
        deps.logger?.warn?.(
          `cleanup failed for ${deps.worktreePath}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    })();
    return started;
  };
}

export type CleanupTrapUnregister = () => void;

export function installCleanupTrap(handler: () => Promise<void>): CleanupTrapUnregister {
  const onSignal = (signal: NodeJS.Signals) => {
    void handler().finally(() => {
      // After cleanup, exit so the parent shell sees the right code.
      // 128 + signal number; treat SIGINT as 130, SIGTERM as 143.
      const code = signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1;
      process.exit(code);
    });
  };

  const onSigint = () => onSignal("SIGINT");
  const onSigterm = () => onSignal("SIGTERM");
  const onExit = () => {
    // exit handlers must be sync — we kick off cleanup but cannot await.
    void handler();
  };

  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);
  process.on("exit", onExit);

  return () => {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
    process.off("exit", onExit);
  };
}
