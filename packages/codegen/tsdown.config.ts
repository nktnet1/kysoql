import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts", "src/commands.ts"],
  dts: true,
  exports: {
    devExports: "development",
    exclude: ["cli", "commands"],
    bin: false,
  },
});
