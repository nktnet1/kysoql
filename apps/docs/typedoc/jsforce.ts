import { createPackageTypeDocConfig } from "./config.ts";

export default createPackageTypeDocConfig({
  packageName: "jsforce",
  outputDirectory: "jsforce",
  title: "JSforce adapter API reference",
  description:
    "Generated API reference for the optional JSforce executor adapter in @kysoql/jsforce.",
  icon: "FileCode",
});
