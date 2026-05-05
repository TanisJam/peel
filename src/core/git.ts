import { existsSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { execa, execaSync } from "execa";

export type Branch = {
  name: string;
  isRemote: boolean;
  committerDate: Date;
};

export type FetchResult = { ok: true } | { ok: false; error: string };

export function findGitRoot(start: string): string | null {
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

function stripGitSuffix(name: string): string {
  return name.endsWith(".git") ? name.slice(0, -4) : name;
}

function lastSegment(url: string): string {
  const trimmed = url.replace(/[/\\]+$/, "");
  const lastSep = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf(":"));
  const tail = lastSep >= 0 ? trimmed.slice(lastSep + 1) : trimmed;
  return stripGitSuffix(tail);
}

export function getRepoName(repoRoot: string): string {
  const result = execaSync("git", ["remote", "get-url", "origin"], {
    cwd: repoRoot,
    reject: false,
  });
  if (
    result.exitCode === 0 &&
    typeof result.stdout === "string" &&
    result.stdout.trim().length > 0
  ) {
    return lastSegment(result.stdout.trim());
  }
  return basename(repoRoot);
}

export function currentBranch(repoRoot: string): string | null {
  const result = execaSync("git", ["symbolic-ref", "--short", "HEAD"], {
    cwd: repoRoot,
    reject: false,
  });
  if (result.exitCode === 0 && typeof result.stdout === "string") {
    return result.stdout.trim();
  }
  return null;
}

export async function gitFetch(
  repoRoot: string,
  opts?: { timeout?: number },
): Promise<FetchResult> {
  try {
    await execa("git", ["fetch", "--prune", "origin"], {
      cwd: repoRoot,
      timeout: opts?.timeout ?? 15_000,
    });
    return { ok: true };
  } catch (err) {
    const error =
      err instanceof Error
        ? "shortMessage" in err && typeof err.shortMessage === "string"
          ? err.shortMessage
          : err.message
        : String(err);
    return { ok: false, error };
  }
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const expanded = escaped.replace(/\*/g, ".*");
  return new RegExp(`^${expanded}$`);
}

export async function listBranches(
  repoRoot: string,
  opts?: { exclude?: string[] },
): Promise<Branch[]> {
  const { stdout } = await execa(
    "git",
    [
      "for-each-ref",
      "--format=%(refname:short)\t%(committerdate:iso8601-strict)",
      "refs/heads",
      "refs/remotes/origin",
    ],
    { cwd: repoRoot },
  );

  const map = new Map<string, Branch>();
  for (const line of String(stdout).split("\n")) {
    if (!line) continue;
    const tab = line.indexOf("\t");
    if (tab === -1) continue;
    const refShort = line.slice(0, tab);
    const dateStr = line.slice(tab + 1);
    if (refShort === "origin/HEAD") continue;
    const isRemote = refShort.startsWith("origin/");
    const plain = isRemote ? refShort.slice("origin/".length) : refShort;
    const committerDate = new Date(dateStr);
    const existing = map.get(plain);
    // Local wins over remote on collision
    if (!existing || (existing.isRemote && !isRemote)) {
      map.set(plain, { name: plain, isRemote, committerDate });
    }
  }

  const excludes = (opts?.exclude ?? []).map(patternToRegex);
  const filtered = Array.from(map.values()).filter((b) => !excludes.some((re) => re.test(b.name)));

  filtered.sort((a, b) => b.committerDate.getTime() - a.committerDate.getTime());
  return filtered;
}
