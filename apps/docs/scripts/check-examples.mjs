import { spawnSync } from "node:child_process";
import { access, copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { codeBlocks, docsRoot, readPages } from "./content.mjs";

const workspace = path.resolve(docsRoot, "../..");
// Check the public declaration surface consumers receive. Each source package
// owns its own #/* aliases; one docs tsconfig cannot merge those local mappings.
const missing = [];
for (const name of ["core", "rest", "jsforce", "codegen"]) {
  try {
    await access(path.join(workspace, "packages", name, "dist/index.d.mts"));
  } catch {
    missing.push(`@kysoql/${name}`);
  }
}
if (missing.length) {
  console.error(`Missing package declarations: ${missing.join(", ")}.`);
  console.error(
    "Build them first: pnpm exec turbo run build --filter=@kysoql/core " +
      "--filter=@kysoql/rest --filter=@kysoql/jsforce --filter=@kysoql/codegen",
  );
  process.exit(1);
}

const output = path.join(docsRoot, ".cache/docs-examples");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const name of ["db.ts", "salesforce.generated.ts"]) {
  await copyFile(
    path.join(docsRoot, "examples", name),
    path.join(output, name),
  );
}

const manifest = [];
for (const page of await readPages()) {
  let number = 0;
  for (const block of codeBlocks(page.text)) {
    if (!["ts", "tsx"].includes(block.language)) {
      continue;
    }
    number++;
    const basename = page.relative.replace(/\.mdx$/, "").replaceAll("/", "--");
    const filename = `${basename}--${number}.${block.language}`;
    // Each complete example is its own module. No example is executed.
    await writeFile(path.join(output, filename), `${block.code}\nexport {};\n`);
    manifest.push({ filename, source: page.relative, line: block.line });
  }
}
await writeFile(
  path.join(output, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
const config = {
  compilerOptions: {
    target: "ESNext",
    module: "ESNext",
    moduleResolution: "Bundler",
    jsx: "react-jsx",
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    verbatimModuleSyntax: true,
    noEmit: true,
    skipLibCheck: true,
    types: ["node"],
    paths: {
      // Resolve JSforce in the adapter workspace, not the website bundle.
      jsforce: [path.join(workspace, "packages/jsforce/node_modules/jsforce")],
    },
  },
  include: ["./*.ts", "./*.tsx"],
};
await writeFile(
  path.join(output, "tsconfig.json"),
  `${JSON.stringify(config, null, 2)}\n`,
);

console.log(
  `Checking ${manifest.length} independent TypeScript examples against the workspace packages' public declarations.`,
);
console.log(
  "Example/source line mapping: apps/docs/.cache/docs-examples/manifest.json",
);
const result = spawnSync(
  "tsc",
  ["--project", path.join(output, "tsconfig.json")],
  {
    cwd: docsRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);
if (result.error) {
  console.error(
    "Unable to start tsc. Install workspace dependencies, then use pnpm --filter docs check:examples.",
  );
  console.error(result.error.message);
}
process.exitCode = result.status ?? 1;
