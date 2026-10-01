import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/salesforce-e2e/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
