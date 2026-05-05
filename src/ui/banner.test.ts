import { describe, expect, it } from "vitest";
import {
  formatBranchNotFound,
  formatCleanSummary,
  formatInstallFailure,
  formatNoWorktrees,
  formatPortBusy,
  formatRunningWarning,
  formatWorktreeTable,
  runBanner,
} from "./banner.js";

describe("formatPortBusy", () => {
  it("includes PID and suggested kill command when holder is given", () => {
    const out = formatPortBusy({
      port: 3000,
      holder: { pid: 12345, command: "next-server" },
    });
    expect(out).toContain("3000");
    expect(out).toContain("12345");
    expect(out).toContain("next-server");
    expect(out).toContain("kill");
  });

  it("falls back to a generic message when no holder is identified", () => {
    const out = formatPortBusy({ port: 3000 });
    expect(out).toContain("3000");
    expect(out).toContain("--port");
  });
});

describe("formatBranchNotFound", () => {
  it("lists did-you-mean suggestions", () => {
    const out = formatBranchNotFound({
      name: "feature/z",
      suggestions: ["feature/x", "feature/y"],
    });
    expect(out).toContain("feature/z");
    expect(out).toContain("feature/x");
    expect(out).toContain("feature/y");
    expect(out.toLowerCase()).toContain("did you mean");
  });

  it("works with no suggestions", () => {
    const out = formatBranchNotFound({ name: "feature/z", suggestions: [] });
    expect(out).toContain("feature/z");
  });
});

describe("formatInstallFailure", () => {
  it("shows the last N lines and the log path", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line${i + 1}`);
    const log = lines.join("\n");
    const out = formatInstallFailure({
      log,
      logPath: "/tmp/peel-install-x.log",
      lastN: 10,
    });
    expect(out).toContain("line50");
    expect(out).toContain("line41");
    expect(out).not.toContain("line40");
    expect(out).toContain("/tmp/peel-install-x.log");
  });
});

describe("formatWorktreeTable", () => {
  it("renders a header and one row per worktree with branch/path/age/status", () => {
    const out = formatWorktreeTable([
      { branch: "feature/x", path: "/tmp/widget-feature-x", ageMs: 5 * 60_000, status: "running" },
      {
        branch: "feature/y",
        path: "/tmp/widget-feature-y",
        ageMs: 2 * 60 * 60_000,
        status: "idle",
      },
    ]);
    expect(out).toContain("feature/x");
    expect(out).toContain("/tmp/widget-feature-x");
    expect(out).toContain("5m");
    expect(out).toContain("running");
    expect(out).toContain("feature/y");
    expect(out).toContain("2h");
    expect(out).toContain("idle");
  });

  it("includes column headers", () => {
    const out = formatWorktreeTable([
      { branch: "feature/x", path: "/p", ageMs: 0, status: "idle" },
    ]);
    expect(out.toLowerCase()).toContain("branch");
    expect(out.toLowerCase()).toContain("path");
    expect(out.toLowerCase()).toContain("age");
    expect(out.toLowerCase()).toContain("status");
  });
});

describe("formatNoWorktrees", () => {
  it("mentions peel run as the next step", () => {
    const out = formatNoWorktrees();
    expect(out.toLowerCase()).toContain("no");
    expect(out).toContain("peel run");
  });
});

describe("formatCleanSummary", () => {
  it("counts removed and reports skipped-running with branch names", () => {
    const out = formatCleanSummary({
      outcomes: [
        { kind: "removed", branch: "feature/x" },
        { kind: "removed", branch: "feature/z" },
        { kind: "skipped-running", branch: "feature/y" },
      ],
    });
    expect(out).toMatch(/removed.*2|2.*removed/i);
    expect(out).toMatch(/skipped.*1|1.*skipped/i);
    expect(out).toContain("feature/y");
  });

  it("reports a friendly message when nothing was removed", () => {
    const out = formatCleanSummary({ outcomes: [] });
    expect(out.toLowerCase()).toContain("nothing");
  });

  it("reports cancellation when cancelled:true", () => {
    const out = formatCleanSummary({ cancelled: true, outcomes: [] });
    expect(out.toLowerCase()).toContain("cancelled");
  });
});

describe("formatRunningWarning", () => {
  it("mentions the branch name and warns about running state", () => {
    const out = formatRunningWarning("feature/x");
    expect(out).toContain("feature/x");
    expect(out.toLowerCase()).toContain("running");
  });
});

describe("runBanner", () => {
  it("includes branch, path, mode, url, and cleanup policy", () => {
    const out = runBanner({
      branch: "feature/x",
      path: "/tmp/widget-feature-x",
      mode: "dev",
      url: "http://localhost:3001",
      autoCleanup: true,
    });
    expect(out).toContain("feature/x");
    expect(out).toContain("widget-feature-x");
    expect(out).toContain("dev");
    expect(out).toContain("http://localhost:3001");
    expect(out.toLowerCase()).toContain("cleanup");
  });
});
