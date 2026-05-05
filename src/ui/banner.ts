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

import { formatAge } from "../core/worktree-filter.js";
import type { WorktreeStatus } from "../core/worktree-filter.js";

export type WorktreeRow = {
  branch: string;
  path: string;
  ageMs: number;
  status: WorktreeStatus;
};

export function formatWorktreeTable(rows: WorktreeRow[]): string {
  const header = ["BRANCH", "PATH", "AGE", "STATUS"];
  const body = rows.map((r) => [r.branch, r.path, formatAge(r.ageMs), r.status]);
  const all = [header, ...body];
  const widths = header.map((_, col) => Math.max(...all.map((row) => (row[col] ?? "").length)));
  const fmt = (row: string[]) =>
    row
      .map((cell, i) => cell.padEnd(widths[i] ?? 0))
      .join("  ")
      .trimEnd();
  return all.map(fmt).join("\n");
}

export function formatNoWorktrees(): string {
  return [
    "No peel-managed worktrees found.",
    "",
    "  Spin up a branch with:  peel run <branch>",
  ].join("\n");
}

export type CleanOutcome =
  | { kind: "removed"; branch: string }
  | { kind: "skipped-running"; branch: string };

export type FormatCleanSummaryArgs = {
  cancelled?: boolean;
  outcomes: CleanOutcome[];
};

export function formatCleanSummary(args: FormatCleanSummaryArgs): string {
  if (args.cancelled) return "Cancelled — no worktrees were removed.";
  const removed = args.outcomes.filter((o) => o.kind === "removed");
  const skipped = args.outcomes.filter((o) => o.kind === "skipped-running");
  if (removed.length === 0 && skipped.length === 0) {
    return "Nothing to remove.";
  }
  const lines: string[] = [];
  lines.push(`Removed ${removed.length} worktree${removed.length === 1 ? "" : "s"}.`);
  if (skipped.length > 0) {
    const names = skipped.map((s) => s.branch).join(", ");
    lines.push(
      `Skipped ${skipped.length} running worktree${skipped.length === 1 ? "" : "s"}: ${names}`,
    );
    lines.push("  Stop them or remove individually with `peel clean <branch>`.");
  }
  return lines.join("\n");
}

export function formatRunningWarning(branch: string): string {
  return `Warning: '${branch}' appears to be running. Removing anyway.`;
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
