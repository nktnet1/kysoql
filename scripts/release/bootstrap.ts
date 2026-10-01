import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { forwardedArgs, requireCommand, run } from "../lib/command.ts";
import { accent, strong, success, warning } from "../lib/output.ts";
import { RELEASE_PACKAGES } from "./policy.ts";

const BOOTSTRAP_VERSION = "0.0.0-bootstrap.0";
const BOOTSTRAP_TAG = "bootstrap";
const DEFAULT_REGISTRY = "https://registry.npmjs.org/";
const ROOT_DIR = resolve(import.meta.dirname, "../..");

interface RootManifest {
  readonly license?: unknown;
  readonly repository?: unknown;
  readonly engines?: unknown;
}

const { values } = parseArgs({
  args: forwardedArgs(),
  options: {
    publish: { type: "boolean", default: false },
    registry: { type: "string", default: DEFAULT_REGISTRY },
    help: { type: "boolean", short: "h", default: false },
  },
});

const registry = values.registry ?? DEFAULT_REGISTRY;

const packageExists = (packageName: string): boolean => {
  try {
    run(
      "pnpm",
      ["view", packageName, "versions", "--json", `--registry=${registry}`],
      { cwd: ROOT_DIR, capture: true },
    );
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isNotFound =
      /E404|FETCH_404|\b404\b/u.test(message) &&
      /(not found|not in the .*registry|failed to fetch metadata)/iu.test(message);
    if (isNotFound) {
      return false;
    }
    throw new Error(
      `Unable to determine whether ${packageName} exists in ${registry}`,
      { cause: error },
    );
  }
};

const createBootstrapManifest = (
  packageName: string,
  rootManifest: RootManifest,
): Readonly<Record<string, unknown>> => ({
  name: packageName,
  version: BOOTSTRAP_VERSION,
  description:
    `Bootstrap placeholder for ${packageName}. ` +
    "Use a normal KySOQL release version for consumers.",
  ...(rootManifest.repository === undefined
    ? {}
    : { repository: rootManifest.repository }),
  ...(rootManifest.license === undefined ? {} : { license: rootManifest.license }),
  ...(rootManifest.engines === undefined ? {} : { engines: rootManifest.engines }),
  files: ["README.md"],
  publishConfig: { access: "public" },
});

const publishBootstrapPackage = async (
  packageName: string,
  rootManifest: RootManifest,
): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), "kysoql-bootstrap-"));
  try {
    await writeFile(
      join(directory, "package.json"),
      `${JSON.stringify(createBootstrapManifest(packageName, rootManifest), null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(directory, "README.md"),
      `# ${packageName}\n\n` +
        `Bootstrap placeholder for \`${packageName}\`. ` +
        "Use a normal KySOQL release version for consumers.\n",
      "utf8",
    );

    const args = [
      "publish",
      ".",
      "--access",
      "public",
      "--tag",
      BOOTSTRAP_TAG,
      `--registry=${registry}`,
      "--ignore-scripts",
    ];
    if (!values.publish) {
      args.push("--dry-run");
    }
    run("pnpm", args, { cwd: directory });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const ensurePublisherAuthentication = (): void => {
  if (!values.publish) {
    return;
  }
  try {
    const username = run(
      "pnpm",
      ["whoami", `--registry=${registry}`],
      { cwd: ROOT_DIR, capture: true },
    ).trim();
    console.log(`Publishing bootstrap packages as ${accent(username)}`);
  } catch (error) {
    throw new Error(
      `pnpm authentication is required. Run pnpm login --registry=${registry}`,
      { cause: error },
    );
  }
};

const printHelp = (): void => {
  console.log(`${strong("Usage:")}
  ${accent("pnpm bootstrap:packages")}
  ${accent("pnpm bootstrap:packages")} --publish [--registry <url>]

Creates only missing @kysoql package names so Trusted Publishing can be
configured before the first real release.

Default behaviour is a registry scan plus pnpm publish --dry-run for every
missing package. --publish creates missing names for real using pnpm credentials.

Bootstrap packages use ${BOOTSTRAP_VERSION} under the non-default
"${BOOTSTRAP_TAG}" dist-tag, so they do not create or move the registry "latest" tag.
Existing package names are always skipped regardless of version.

After publishing the placeholders, run:
  pnpm oidc:trust

Then use the normal GitHub release flow for real beta/stable releases.`);
};

const main = async (): Promise<void> => {
  if (values.help) {
    printHelp();
    return;
  }

  requireCommand("pnpm");
  const rootManifest = JSON.parse(
    await readFile(resolve(ROOT_DIR, "package.json"), "utf8"),
  ) as RootManifest;

  const missing: string[] = [];
  for (const definition of RELEASE_PACKAGES) {
    if (packageExists(definition.name)) {
      console.log(
        `${success("SKIP")} ${accent(definition.name)} already exists`,
      );
    } else {
      missing.push(definition.name);
      console.log(
        `${warning("CREATE")} ${accent(definition.name)} does not exist`,
      );
    }
  }

  if (missing.length === 0) {
    console.log(
      `${success("READY")} All ${accent("@kysoql")} release package names already exist.`,
    );
    console.log(`Next step: ${accent("pnpm oidc:trust")}`);
    return;
  }

  ensurePublisherAuthentication();
  let published = 0;
  for (const packageName of missing) {
    if (values.publish && packageExists(packageName)) {
      console.log(`${success("SKIP")} ${accent(packageName)} now exists`);
      continue;
    }
    await publishBootstrapPackage(packageName, rootManifest);
    published += 1;
    console.log(
      values.publish
        ? `PUBLISHED ${packageName}@${BOOTSTRAP_VERSION}`
        : `DRY-RUN ${packageName}@${BOOTSTRAP_VERSION}`,
    );
  }

  if (values.publish) {
    console.log(
      `${success("DONE")} Bootstrapped ${accent(String(published))} package name(s).`,
    );
    console.log(`Next step: ${accent("pnpm oidc:trust")}`);
  } else {
    console.log(
      `${success("VALID")} ${accent(String(published))} missing package name(s).`,
    );
    console.log(
      `Publish them with: ${accent("pnpm bootstrap:packages")} --publish`,
    );
  }
};

await main();
