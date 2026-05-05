import { createServer } from "node:net";
import { execa } from "execa";

export type PortHolder = { pid: number; command: string };

export function isPortBusy(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    const server = createServer();
    server.unref();

    const cleanup = () => {
      server.removeAllListeners();
    };

    server.once("error", (err: NodeJS.ErrnoException) => {
      cleanup();
      if (err.code === "EADDRINUSE" || err.code === "EACCES") {
        resolve(true);
      } else {
        reject(err);
      }
    });

    server.once("listening", () => {
      cleanup();
      server.close(() => resolve(false));
    });

    server.listen(port, "127.0.0.1");
  });
}

export async function findFreePort(base: number, range: number): Promise<number | null> {
  for (let i = 0; i < range; i++) {
    const candidate = base + i;
    if (!(await isPortBusy(candidate))) return candidate;
  }
  return null;
}

async function which(cmd: string): Promise<boolean> {
  const result = await execa("which", [cmd], { reject: false });
  return result.exitCode === 0;
}

async function whoHoldsPortLsof(port: number): Promise<PortHolder | null> {
  const result = await execa("lsof", ["-i", `:${port}`, "-P", "-n", "-F", "pcL", "-sTCP:LISTEN"], {
    reject: false,
  });
  if (result.exitCode !== 0 || typeof result.stdout !== "string") return null;

  let pid: number | null = null;
  let command: string | null = null;
  for (const line of result.stdout.split("\n")) {
    if (line.startsWith("p")) {
      const n = Number.parseInt(line.slice(1), 10);
      if (Number.isFinite(n)) pid = n;
    } else if (line.startsWith("c")) {
      command = line.slice(1);
    }
    if (pid !== null && command !== null) break;
  }

  if (pid === null) return null;
  return { pid, command: command ?? "" };
}

async function whoHoldsPortSs(port: number): Promise<PortHolder | null> {
  const result = await execa("ss", ["-lptnH", `sport = :${port}`], {
    reject: false,
  });
  if (result.exitCode !== 0 || typeof result.stdout !== "string") return null;

  // Sample line:
  // LISTEN 0 511 0.0.0.0:3000 0.0.0.0:* users:(("node",pid=12345,fd=20))
  const match = result.stdout.match(/users:\(\("([^"]+)",pid=(\d+)/);
  if (!match) return null;
  const [, command, pidStr] = match;
  if (!pidStr || !command) return null;
  const pid = Number.parseInt(pidStr, 10);
  if (!Number.isFinite(pid)) return null;
  return { pid, command };
}

export async function whoHoldsPort(port: number): Promise<PortHolder | null> {
  if (await which("lsof")) {
    const r = await whoHoldsPortLsof(port);
    if (r) return r;
  }
  if (await which("ss")) {
    const r = await whoHoldsPortSs(port);
    if (r) return r;
  }
  return null;
}
