import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as yamlParse } from "yaml";
import { ZodError } from "zod";
import { DEFAULT_CONFIG } from "./config-defaults.js";
import { type Config, ConfigSchema } from "./config-schema.js";

export type PeelConfigErrorKind = "not-found" | "malformed-yaml" | "schema-invalid";

export class PeelConfigError extends Error {
  constructor(
    message: string,
    public readonly kind: PeelConfigErrorKind,
    public readonly path?: string,
  ) {
    super(message);
    this.name = "PeelConfigError";
  }
}

const CONFIG_FILE = ".peel.yml";

function findGitRootLocal(start: string): string | null {
  let cur = resolve(start);
  while (true) {
    const candidate = join(cur, ".git");
    if (existsSync(candidate)) {
      try {
        statSync(candidate);
        return cur;
      } catch {
        // ignore
      }
    }
    const parent = dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

function findConfigPath(cwd: string): string | null {
  const cwdResolved = resolve(cwd);
  const direct = join(cwdResolved, CONFIG_FILE);
  if (existsSync(direct)) return direct;

  const root = findGitRootLocal(cwdResolved);
  if (root && root !== cwdResolved) {
    const fromRoot = join(root, CONFIG_FILE);
    if (existsSync(fromRoot)) return fromRoot;
  }
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function deepMerge<T>(defaults: T, partial: unknown): T {
  if (!isPlainObject(partial) || !isPlainObject(defaults)) {
    return partial === undefined ? defaults : (partial as T);
  }
  const result: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(partial)) {
    const dv = (defaults as Record<string, unknown>)[key];
    const pv = partial[key];
    if (isPlainObject(dv) && isPlainObject(pv)) {
      result[key] = deepMerge(dv, pv);
    } else {
      result[key] = pv;
    }
  }
  return result as T;
}

export function loadConfig(cwd: string): Config | null {
  const path = findConfigPath(cwd);
  if (path === null) return null;

  const raw = readFileSync(path, "utf8");

  let parsed: unknown;
  try {
    parsed = yamlParse(raw);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new PeelConfigError(`Malformed YAML in ${path}: ${detail}`, "malformed-yaml", path);
  }

  const partial = parsed === undefined || parsed === null ? {} : parsed;
  if (!isPlainObject(partial)) {
    throw new PeelConfigError(`Top-level of ${path} must be a mapping`, "schema-invalid", path);
  }

  const merged = deepMerge(DEFAULT_CONFIG, partial);
  try {
    return ConfigSchema.parse(merged);
  } catch (err) {
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      const fieldPath = issue?.path.join(".") ?? "<root>";
      throw new PeelConfigError(
        `Invalid value at ${fieldPath}: ${issue?.message ?? "schema error"} (in ${path})`,
        "schema-invalid",
        path,
      );
    }
    throw err;
  }
}
