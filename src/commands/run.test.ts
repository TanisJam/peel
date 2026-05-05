import { describe, expect, it } from "vitest";
import { RunFlowError } from "../core/run-flow.js";
import { formatRunFlowError } from "./run.js";

describe("formatRunFlowError", () => {
  it("formats branch-not-found with suggestions", () => {
    const err = new RunFlowError("not found", "branch-not-found", {
      name: "feature/z",
      suggestions: ["feature/x", "feature/y"],
    });
    const out = formatRunFlowError(err);
    expect(out).toContain("feature/z");
    expect(out).toContain("feature/x");
    expect(out.toLowerCase()).toContain("did you mean");
  });

  it("formats port-busy with holder PID and kill command", () => {
    const err = new RunFlowError("busy", "port-busy", {
      port: 3000,
      holder: { pid: 12345, command: "next-server" },
    });
    const out = formatRunFlowError(err);
    expect(out).toContain("3000");
    expect(out).toContain("12345");
    expect(out).toContain("kill");
  });

  it("formats port-busy without a holder", () => {
    const err = new RunFlowError("busy", "port-busy", {
      port: 3000,
      holder: null,
    });
    const out = formatRunFlowError(err);
    expect(out).toContain("3000");
    expect(out).not.toContain("PID");
  });

  it("formats install-failed with log path", () => {
    const err = new RunFlowError("fail", "install-failed", {
      log: "line1\nline2",
      logPath: "/tmp/peel-install-x.log",
    });
    const out = formatRunFlowError(err);
    expect(out).toContain("Install failed");
    expect(out).toContain("/tmp/peel-install-x.log");
  });

  it("formats hook-failed with the command and exit code", () => {
    const err = new RunFlowError("hook fail", "hook-failed", {
      failedAt: 1,
      command: "pnpm db:migrate",
      exitCode: 2,
    });
    const out = formatRunFlowError(err);
    expect(out).toContain("#2"); // 0-indexed +1 in formatter
    expect(out).toContain("pnpm db:migrate");
    expect(out).toContain("exit 2");
  });

  it("formats locked with PID and lock path", () => {
    const err = new RunFlowError("locked", "locked", {
      pid: 99999,
      worktreePath: "/tmp/widget-feature-x",
    });
    const out = formatRunFlowError(err);
    expect(out).toContain("99999");
    expect(out).toContain("/tmp/widget-feature-x");
    expect(out).toContain("peel.lock");
  });

  it("returns the bare message for no-config", () => {
    const err = new RunFlowError("Run `peel init` first.", "no-config");
    expect(formatRunFlowError(err)).toBe("Run `peel init` first.");
  });
});
