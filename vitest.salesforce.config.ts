import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/salesforce-e2e/**/*.test.mjs"],
    testTimeout: 60_000,
  },
});
