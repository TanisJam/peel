import type { Config } from "./config-schema.js";
import { SCHEMA_VERSION } from "./config-schema.js";

export const DEFAULT_CONFIG: Config = {
  version: SCHEMA_VERSION,
  port: { base: 3000, strategy: "fixed" },
  envFiles: [],
  packageManager: "npm",
  commands: {
    install: "npm install",
    dev: "npm run dev",
    build: "npm run build",
    start: "npm start",
  },
  preRun: [],
  worktree: { baseDir: "..", prefix: "", autoCleanup: true },
  git: { fetchOnStart: true, includeRemoteBranches: true, excludeBranches: [] },
};
