import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { dir } from "tmp-promise";

export type GitFixture = {
  repoRoot: string;
  bareRoot: string;
  branches: string[];
  cleanup: () => Promise<void>;
};

const ENV = {
  GIT_AUTHOR_NAME: "peel-test",
  GIT_AUTHOR_EMAIL: "peel@test.local",
  GIT_COMMITTER_NAME: "peel-test",
  GIT_COMMITTER_EMAIL: "peel@test.local",
};

async function git(cwd: string, args: string[]): Promise<void> {
  await execa("git", args, { cwd, env: ENV });
}

export async function createGitFixture(): Promise<GitFixture> {
  const bareDir = await dir({ unsafeCleanup: true });
  const repoDir = await dir({ unsafeCleanup: true });
  const bareRoot = bareDir.path;
  const repoRoot = repoDir.path;

  await git(bareRoot, ["init", "--bare", "-b", "main"]);

  await git(repoRoot, ["init", "-b", "main"]);
  await git(repoRoot, ["remote", "add", "origin", `file://${bareRoot}`]);

  await writeFile(join(repoRoot, "README.md"), "# fixture\n", "utf8");
  await git(repoRoot, ["add", "."]);
  await git(repoRoot, ["commit", "-m", "feat: seed"]);
  await git(repoRoot, ["push", "-u", "origin", "main"]);

  // Create the second branch with a newer commit
  await git(repoRoot, ["checkout", "-b", "feature/x"]);
  await writeFile(join(repoRoot, "feature.txt"), "x\n", "utf8");
  await git(repoRoot, ["add", "."]);
  await git(repoRoot, ["commit", "-m", "feat: feature x"]);
  await git(repoRoot, ["push", "-u", "origin", "feature/x"]);

  // Return to main
  await git(repoRoot, ["checkout", "main"]);

  // Make sure remote-tracking refs are present
  await git(repoRoot, ["fetch", "origin"]);

  const cleanup = async (): Promise<void> => {
    await Promise.all([bareDir.cleanup(), repoDir.cleanup()]);
  };

  return {
    repoRoot,
    bareRoot,
    branches: ["main", "feature/x"],
    cleanup,
  };
}
