import { rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import type { Config } from "./config-schema.js";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function diff(value: unknown, def: unknown): unknown {
  if (deepEqual(value, def)) return undefined;
  if (isPlainObject(value) && isPlainObject(def)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      const sub = diff(value[key], def[key]);
      if (sub !== undefined) out[key] = sub;
    }
    return Object.keys(out).length === 0 ? undefined : out;
  }
  return value;
}

export function pickNonDefault<T extends object>(value: T, defaults: T): Partial<T> {
  const result = diff(value, defaults);
  return (result ?? {}) as Partial<T>;
}

function serialize(partial: Partial<Config>): string {
  if (Object.keys(partial).length === 0) return "";
  const body = yamlStringify(partial as Json, {
    lineWidth: 100,
    indent: 2,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
  });
  return body.endsWith("\n") ? body : `${body}\n`;
}

export async function writeConfig(config: Config, targetPath: string): Promise<void> {
  const partial = pickNonDefault(config, await getDefaults());
  const body = serialize(partial);
  const dir = dirname(targetPath);
  const tmp = join(dir, `.peel.yml.${process.pid}.tmp`);

  try {
    await writeFile(tmp, body, { encoding: "utf8" });
    await rename(tmp, targetPath);
  } catch (err) {
    await unlink(tmp).catch(() => undefined);
    throw err;
  }
}

async function getDefaults(): Promise<Config> {
  const mod = await import("./config-defaults.js");
  return mod.DEFAULT_CONFIG;
}
