import { createPackageTypeDocConfig } from "./config.ts";

export default createPackageTypeDocConfig({
  packageName: "codegen",
  outputDirectory: "codegen",
  title: "Codegen API reference",
  description:
    "Generated API reference for schema generation, Describe clients, rendering, field filters, and configuration in @kysoql/codegen.",
  icon: "FileCode",
});
