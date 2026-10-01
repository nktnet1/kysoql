import { setTimeout } from "node:timers/promises";

import { requireCommand, run } from "../lib/command.ts";
import { RELEASE_PACKAGES } from "./policy.ts";

const MINIMUM_NPM = [11, 15, 0] as const;
const REPOSITORY = "nktnet1/kysoql";
const WORKFLOW = "publish.yml";
const ENVIRONMENT = "Production";

const parseVersion = (source: string): readonly number[] =>
  source
    .trim()
    .split(".")
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10));

const compareVersion = (
  left: readonly number[],
  right: readonly number[],
): number => {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
};

requireCommand("npm");
const npmVersion = parseVersion(run("npm", ["--version"], { capture: true }));
if (
  npmVersion.some(Number.isNaN) ||
  compareVersion(npmVersion, MINIMUM_NPM) < 0
) {
  throw new Error(
    `npm >=${MINIMUM_NPM.join(".")} is required to configure trusted ` +
      "publishing",
  );
}

for (const [index, definition] of RELEASE_PACKAGES.entries()) {
  console.log(`Configuring npm trusted publishing for ${definition.name}`);
  run("npm", [
    "trust",
    "github",
    definition.name,
    "--repo",
    REPOSITORY,
    "--file",
    WORKFLOW,
    "--env",
    ENVIRONMENT,
    "--allow-publish",
    "--yes",
  ]);
  if (index + 1 < RELEASE_PACKAGES.length) {
    await setTimeout(2_000);
  }
}
