import { createPackageTypeDocConfig } from "./config.ts";

export default createPackageTypeDocConfig({
  packageName: "rest",
  outputDirectory: "rest",
  title: "REST API reference",
  description:
    "Generated API reference for the native Salesforce REST client, executor, pagination, OAuth compatibility, and errors in @kysoql/rest.",
  icon: "FileCode",
});
