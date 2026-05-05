import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;

export const PackageManagerSchema = z.enum(["npm", "pnpm", "yarn", "bun"]);
export type PackageManager = z.infer<typeof PackageManagerSchema>;

export const PortStrategySchema = z.enum(["fixed", "auto-find"]);
export type PortStrategy = z.infer<typeof PortStrategySchema>;

export const ConfigSchema = z
  .object({
    version: z.literal(SCHEMA_VERSION),
    port: z
      .object({
        base: z.number().int().positive(),
        strategy: PortStrategySchema,
      })
      .strict(),
    envFiles: z.array(z.string()),
    packageManager: PackageManagerSchema,
    commands: z
      .object({
        install: z.string(),
        dev: z.string(),
        build: z.string(),
        start: z.string(),
      })
      .strict(),
    preRun: z.array(z.string()),
    worktree: z
      .object({
        baseDir: z.string(),
        prefix: z.string(),
        autoCleanup: z.boolean(),
      })
      .strict(),
    git: z
      .object({
        fetchOnStart: z.boolean(),
        includeRemoteBranches: z.boolean(),
        excludeBranches: z.array(z.string()),
      })
      .strict(),
  })
  .strict();

export type Config = z.infer<typeof ConfigSchema>;
