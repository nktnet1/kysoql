import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  dts: true,
  exports: {
    devExports: "development",
    exclude: ["cli"],
    bin: false,
  },
});
