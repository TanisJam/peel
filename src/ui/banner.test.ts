import { describe, expect, it } from "vitest";
import { formatBranchNotFound, formatInstallFailure, formatPortBusy, runBanner } from "./banner.js";

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
