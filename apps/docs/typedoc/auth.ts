import { createPackageTypeDocConfig } from "./config.ts";

export default createPackageTypeDocConfig({
  packageName: "auth",
  outputDirectory: "auth",
  title: "Auth API reference",
  description:
    "Generated API reference for Salesforce authentication, OAuth flows, token storage, and refresh management in @kysoql/auth.",
  icon: "FileCode",
});
