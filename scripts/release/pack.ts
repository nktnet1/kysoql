import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  forwardedArgs,
  parseJson,
  requireCommand,
  requireSupportedNode,
  run,
} from "../lib/command.ts";
import {
  RELEASE_PACKAGES,
  versionFromReleaseTag,
} from "./policy.ts";

const ROOT_DIR = resolve(import.meta.dirname, "../..");

type JsonObject = Readonly<Record<string, unknown>>;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readWorkspaceVersion = async (): Promise<string> => {
  const parsed = parseJson<unknown>(
    await readFile(resolve(ROOT_DIR, "package.json"), "utf8"),
    "root package.json",
  );
  if (!isJsonObject(parsed) || typeof parsed.version !== "string") {
    throw new Error("root package.json must contain a version");
  }
  return parsed.version;
};

const { values } = parseArgs({
  args: forwardedArgs(),
  options: {
    output: { type: "string", default: "release-packages" },
    tag: { type: "string" },
  },
});

requireSupportedNode();
requireCommand("pnpm");

const workspaceVersion = await readWorkspaceVersion();
if (values.tag !== undefined) {
  const taggedVersion = versionFromReleaseTag(values.tag);
  if (taggedVersion !== workspaceVersion) {
    throw new Error(
      `Release tag ${values.tag} does not match workspace version ` +
        workspaceVersion,
    );
  }
}

const output = resolve(ROOT_DIR, values.output ?? "release-packages");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const definition of RELEASE_PACKAGES) {
  console.log(`Packing ${definition.name}@${workspaceVersion}`);
  run(
    "pnpm",
    ["pack", "--pack-destination", output],
    { cwd: resolve(ROOT_DIR, definition.workspacePath) },
  );
}

const tarballs = (await readdir(output)).filter((file) =>
  file.endsWith(".tgz"),
);
if (tarballs.length !== RELEASE_PACKAGES.length) {
  throw new Error(
    `Expected ${RELEASE_PACKAGES.length} release tarballs, found ` +
      tarballs.length,
  );
}

console.log(`Packed ${tarballs.length} release packages into ${output}`);
