#!/usr/bin/env node
import * as clack from "@clack/prompts";
import { Command } from "commander";
import { PeelInitError, runInitCommand } from "./commands/init.js";
import { formatError } from "./ui/banner.js";
import { ClackPrompter } from "./ui/clack-prompter.js";
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

program.action(() => {
  console.log(`peel v${VERSION} — coming soon.`);
  console.log(
    "Spin up any branch in an isolated git worktree, with its own node_modules, env, and port.",
  );
  console.log("\nRun `peel init` to get started.");
});

await program.parseAsync(process.argv);
