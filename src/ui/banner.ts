export function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export type PortHolderInfo = {
  pid: number;
  command: string;
};

export type FormatPortBusyArgs = {
  port: number;
  holder?: PortHolderInfo;
};

export function formatPortBusy(args: FormatPortBusyArgs): string {
  if (args.holder) {
    return [
      `Port ${args.port} is in use by:`,
      `    ${args.holder.command} (PID ${args.holder.pid})`,
      "",
      `  Free it with:  kill ${args.holder.pid}`,
      "  Or run with:   peel run --port <other-port>",
    ].join("\n");
  }
  return [
    `Port ${args.port} is in use.`,
    "",
    `  Free it with:  lsof -ti:${args.port} | xargs kill -9`,
    "  Or run with:   peel run --port <other-port>",
  ].join("\n");
}

export type FormatBranchNotFoundArgs = {
  name: string;
  suggestions: string[];
};

export function formatBranchNotFound(args: FormatBranchNotFoundArgs): string {
  const head = `Branch '${args.name}' not found locally or on origin.`;
  if (args.suggestions.length === 0) return head;
  return `${head}\n  Did you mean: ${args.suggestions.join(", ")}?`;
}

export type FormatInstallFailureArgs = {
  log: string;
  logPath: string;
  lastN?: number;
};

export function formatInstallFailure(args: FormatInstallFailureArgs): string {
  const lines = args.log.split("\n");
  const lastN = args.lastN ?? 30;
  const tail = lines.slice(-lastN).join("\n");
  return [
    "Install failed.",
    `Last ${Math.min(lastN, lines.length)} lines:`,
    tail,
    "",
    `Full log at: ${args.logPath}`,
  ].join("\n");
}

export type RunBannerArgs = {
  branch: string;
  path: string;
  mode: "dev" | "build";
  url?: string;
  autoCleanup: boolean;
};

export function runBanner(args: RunBannerArgs): string {
  const lines = [
    `▸ branch:   ${args.branch}`,
    `▸ path:     ${args.path}`,
    `▸ mode:     ${args.mode}`,
  ];
  if (args.url) lines.push(`▸ url:      ${args.url}`);
  lines.push(
    `▸ cleanup:  ${args.autoCleanup ? "on exit (use --keep to disable)" : "disabled (--keep)"}`,
  );
  return lines.join("\n");
}
