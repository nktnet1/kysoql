import path from "node:path";
import { createTypeDocConfig } from "#/config";
import { ROOT_PATH } from "#/configs/shared";

export default createTypeDocConfig({
  entryPoint: path.join(ROOT_PATH, "packages/core/src/index.ts"),
  outputPath: path.join(ROOT_PATH, "apps/docs/content/docs/core/reference/api"),
  tsconfigPath: path.join(ROOT_PATH, "packages/core/tsconfig.json"),
  frontmatterPath: path.join(
    ROOT_PATH,
    "tools/typedoc/assets/core/frontmatter.md",
  ),
});
