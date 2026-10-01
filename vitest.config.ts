import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/tests/**/*.test.ts", "tests/scripts/**/*.test.ts"],
    fsModuleCache: true,
    isolate: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["packages/*/src/**/*.ts"],
    },
  },
});
