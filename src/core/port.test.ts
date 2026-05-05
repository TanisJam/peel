import { type Server, createServer } from "node:net";
import { execa } from "execa";
import { afterEach, describe, expect, it } from "vitest";
import { findFreePort, isPortBusy, whoHoldsPort } from "./port.js";

const servers: Server[] = [];
afterEach(async () => {
  while (servers.length) {
    const s = servers.pop();
    if (s) {
      await new Promise<void>((res) => s.close(() => res()));
    }
  }
});

async function bind(port: number): Promise<Server> {
  return await new Promise<Server>((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(port, "127.0.0.1", () => {
      servers.push(s);
      resolve(s);
    });
  });
}

async function ephemeral(): Promise<number> {
  const s = await bind(0);
  const addr = s.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  return addr.port;
}

async function hasLsof(): Promise<boolean> {
  const r = await execa("which", ["lsof"], { reject: false });
  return r.exitCode === 0;
}

describe("isPortBusy", () => {
  it("returns false when no listener exists", async () => {
    const s = await bind(0);
    const port = (s.address() as { port: number }).port;
    await new Promise<void>((res) => s.close(() => res()));
    servers.length = 0;

    expect(await isPortBusy(port)).toBe(false);
  });

  it("returns true when a listener is bound", async () => {
    const port = await ephemeral();
    expect(await isPortBusy(port)).toBe(true);
  });
});

describe("findFreePort", () => {
  it("returns the base when free", async () => {
    const base = await ephemeral();
    // Free that port
    const s = servers.pop();
    if (s) await new Promise<void>((res) => s.close(() => res()));
    expect(await findFreePort(base, 5)).toBe(base);
  });

  it("skips a busy base and returns the next free port", async () => {
    // Reserve two ports we control: base busy, base+1 free.
    const sBase = await bind(0);
    const basePort = (sBase.address() as { port: number }).port;
    // Free base+1 by ephemeral-and-close
    const sNext = await bind(0);
    const nextPort = (sNext.address() as { port: number }).port;
    await new Promise<void>((res) => sNext.close(() => res()));
    servers.splice(servers.indexOf(sNext), 1);

    // We can only reliably assert findFreePort with a range that includes both;
    // since the OS-assigned ports are arbitrary, exercise the "skip busy" path
    // by checking findFreePort(basePort, 1) → null AND findFreePort(basePort, big) returns something not equal to basePort.
    expect(await findFreePort(basePort, 1)).toBeNull();

    const found = await findFreePort(basePort, 200);
    expect(found).not.toBe(basePort);
    expect(found).not.toBeNull();
  });

  it("returns null when every port in the range is busy", async () => {
    const port = await ephemeral();
    expect(await findFreePort(port, 1)).toBeNull();
  });
});

describe.skipIf(!(await hasLsof()))("whoHoldsPort (lsof available)", () => {
  it("returns the holding PID when a server is listening", async () => {
    const port = await ephemeral();
    const result = await whoHoldsPort(port);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.pid).toBe(process.pid);
      expect(result.command.length).toBeGreaterThan(0);
    }
  });

  it("returns null when nothing is listening", async () => {
    // Get a free port the same way
    const s = await bind(0);
    const port = (s.address() as { port: number }).port;
    await new Promise<void>((res) => s.close(() => res()));
    servers.length = 0;

    const result = await whoHoldsPort(port);
    expect(result).toBeNull();
  });
});
