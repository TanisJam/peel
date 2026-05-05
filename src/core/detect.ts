import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { PackageManager } from "./config-schema.js";

const LOCKFILE_PRECEDENCE: ReadonlyArray<{ file: string; pm: PackageManager }> = [
  { file: "pnpm-lock.yaml", pm: "pnpm" },
  { file: "bun.lock", pm: "bun" },
  { file: "bun.lockb", pm: "bun" },
  { file: "yarn.lock", pm: "yarn" },
  { file: "package-lock.json", pm: "npm" },
];

const VALID_PMS: ReadonlySet<PackageManager> = new Set(["npm", "pnpm", "yarn", "bun"]);

type RawPackageJson = {
  packageManager?: unknown;
  scripts?: Record<string, unknown>;
};

function readPackageJson(cwd: string): RawPackageJson | null {
  const path = join(cwd, "package.json");
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as RawPackageJson) : null;
  } catch {
    return null;
  }
}

export function detectPackageManager(cwd: string): PackageManager {
  const pkg = readPackageJson(cwd);
  if (pkg && typeof pkg.packageManager === "string") {
    const head = pkg.packageManager.split("@", 1)[0] as PackageManager;
    if (VALID_PMS.has(head)) return head;
  }
  for (const { file, pm } of LOCKFILE_PRECEDENCE) {
    if (existsSync(join(cwd, file))) return pm;
  }
  return "npm";
}

export function detectEnvFiles(cwd: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(cwd);
  } catch {
    return [];
  }
  return entries
    .filter((name) => name.startsWith(".env"))
    .filter((name) => !name.endsWith(".example") && !name.endsWith(".sample"))
    .sort();
}

export type DetectedScripts = {
  dev: string | null;
  build: string | null;
  start: string | null;
};

export function detectScripts(cwd: string): DetectedScripts {
  const pkg = readPackageJson(cwd);
  const scripts = pkg?.scripts ?? {};
  const pick = (k: "dev" | "build" | "start"): string | null => {
    const v = scripts[k];
    return typeof v === "string" ? v : null;
  };
  return { dev: pick("dev"), build: pick("build"), start: pick("start") };
}
