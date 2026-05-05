import { existsSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { join } from "node:path";

export type EnvCopyResult = {
  copied: string[];
  skipped: string[];
  missing: string[];
};

export type CopyEnvArgs = {
  src: string;
  dest: string;
  files: string[];
};

export async function copyEnvFiles(args: CopyEnvArgs): Promise<EnvCopyResult> {
  const result: EnvCopyResult = { copied: [], skipped: [], missing: [] };

  for (const name of args.files) {
    const srcPath = join(args.src, name);
    const destPath = join(args.dest, name);

    if (!existsSync(srcPath)) {
      result.missing.push(name);
      continue;
    }
    if (existsSync(destPath)) {
      result.skipped.push(name);
      continue;
    }
    await copyFile(srcPath, destPath);
    result.copied.push(name);
  }

  return result;
}
