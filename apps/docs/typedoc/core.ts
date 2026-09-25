import { createPackageTypeDocConfig } from "./config.ts";

export default createPackageTypeDocConfig({
  packageName: "core",
  outputDirectory: "core/reference",
  title: "Core API reference",
  description:
    "Generated API reference for query builders, schema types, compilation, plugins, and SOQL helpers in @kysoql/core.",
  icon: "FileCode",
});
