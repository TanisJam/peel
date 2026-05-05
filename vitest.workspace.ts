import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "unit",
      include: ["src/**/*.test.ts"],
      environment: "node",
    },
  },
  {
    test: {
      name: "integration",
      include: ["test/**/*.integration.test.ts"],
      environment: "node",
      testTimeout: 30_000,
    },
  },
]);
