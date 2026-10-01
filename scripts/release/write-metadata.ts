import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { versionFromReleaseTag } from "./policy.ts";

const ROOT_DIR = resolve(import.meta.dirname, "../..");
const { values } = parseArgs({
  options: {
    output: { type: "string", default: "release-metadata" },
    sha: { type: "string" },
    tag: { type: "string" },
  },
});

const tag = values.tag;
const sha = values.sha;
if (tag === undefined || sha === undefined) {
  throw new Error("--tag and --sha are required");
}
versionFromReleaseTag(tag);
if (!/^[a-f0-9]{40}$/u.test(sha)) {
  throw new Error(`Invalid Git SHA: ${sha}`);
}

const output = resolve(ROOT_DIR, values.output ?? "release-metadata");
await mkdir(output, { recursive: true });
await Promise.all([
  writeFile(resolve(output, "tag"), `${tag}\n`, "utf8"),
  writeFile(resolve(output, "sha"), `${sha}\n`, "utf8"),
]);
console.log(`Wrote release metadata for ${tag} (${sha})`);
