#!/usr/bin/env node
import * as clack from "@clack/prompts";
import { Command } from "commander";
import { PeelInitError, runInitCommand } from "./commands/init.js";
import { runCommand } from "./commands/run.js";
import { formatError } from "./ui/banner.js";
import { ClackPrompter } from "./ui/clack-prompter.js";
import { ExecaRunner } from "./ui/runner-execa.js";
import { VERSION } from "./version.js";

const program = new Command();

program
  .name("peel")
  .description(
    "Spin up any branch in an isolated git worktree, with its own node_modules, env, and port.",
  )
  .version(VERSION);

program
  .command("init")
  .description("Generate a .peel.yml config in the current repo")
  .option("-y, --yes", "Skip prompts and use detected defaults", false)
  .action(async (opts: { yes: boolean }) => {
    try {
      const prompter = new ClackPrompter();
      if (!opts.yes) {
        prompter.intro("peel init");
      }
      await runInitCommand({ cwd: process.cwd(), prompter, yes: opts.yes });
      if (!opts.yes) {
        prompter.outro("Wrote .peel.yml — peel is ready.");
      }
    } catch (err) {
      if (err instanceof PeelInitError) {
        clack.cancel(formatError(err));
        process.exit(1);
      }
      throw err;
    }
  });

type RunOpts = {
  keep: boolean;
  mode?: "dev" | "build";
  port?: string;
  fetch: boolean;
  branch?: string;
  yes: boolean;
};

program
  .command("run [branch] [mode]")
  .description("Spin up a branch in a fresh worktree and run dev or build")
  .option("-k, --keep", "Do not remove the worktree on exit", false)
  .option("--mode <mode>", "Force mode (dev|build)")
  .option("--port <n>", "Override the base port for this run")
  .option("--no-fetch", "Skip the initial git fetch")
  .option("-b, --branch <name>", "Branch to run (alternative to positional)")
  .option("-y, --yes", "Skip confirmations and use defaults", false)
  .action(async (branchArg: string | undefined, modeArg: string | undefined, opts: RunOpts) => {
    const prompter = new ClackPrompter();
    const runner = new ExecaRunner();

    const branch = branchArg ?? opts.branch;
    const modeRaw = modeArg ?? opts.mode;
    const mode = modeRaw === "dev" || modeRaw === "build" ? modeRaw : undefined;
    const port = opts.port !== undefined ? Number.parseInt(opts.port, 10) : undefined;
    if (port !== undefined && !Number.isFinite(port)) {
      console.error(`Invalid --port value: ${opts.port}`);
      process.exit(1);
    }

    const result = await runCommand({
      cwd: process.cwd(),
      prompter,
      runner,
      ...(branch !== undefined ? { branch } : {}),
      ...(mode !== undefined ? { mode } : {}),
      ...(port !== undefined ? { port } : {}),
      keep: opts.keep,
      noFetch: !opts.fetch,
      yes: opts.yes,
    });

    if (result.message) {
      if (result.exitCode === 0) {
        console.log(result.message);
      } else {
        console.error(result.message);
      }
    }
    process.exit(result.exitCode);
  });

program.action(() => {
  console.log(`peel v${VERSION} — coming soon.`);
  console.log(
    "Spin up any branch in an isolated git worktree, with its own node_modules, env, and port.",
  );
  console.log("\nRun `peel init` to get started, then `peel run <branch> <mode>` to launch.");
});

await program.parseAsync(process.argv);
