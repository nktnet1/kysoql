import path from "node:path";
import { createTypeDocConfig } from "#/config";
import { ROOT_PATH } from "#/configs/shared";

export default createTypeDocConfig({
  entryPoint: path.join(ROOT_PATH, "packages/auth/src/index.ts"),
  outputPath: path.join(ROOT_PATH, "apps/docs/content/docs/auth"),
  tsconfigPath: path.join(ROOT_PATH, "packages/auth/tsconfig.json"),
  frontmatterPath: path.join(
    ROOT_PATH,
    "tools/typedoc/assets/auth/frontmatter.md",
  ),
});
