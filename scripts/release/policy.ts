export const NPM_SCOPE = "@kysoql";

export interface ReleasePackageDefinition {
  readonly name: string;
  readonly workspacePath: string;
  readonly internalDependencies: readonly string[];
}

export const RELEASE_PACKAGES = [
  {
    name: "@kysoql/core",
    workspacePath: "packages/core",
    internalDependencies: [],
  },
  {
    name: "@kysoql/rest",
    workspacePath: "packages/rest",
    internalDependencies: ["@kysoql/core"],
  },
  {
    name: "@kysoql/auth",
    workspacePath: "packages/auth",
    internalDependencies: [],
  },
  {
    name: "@kysoql/jsforce",
    workspacePath: "packages/jsforce",
    internalDependencies: ["@kysoql/core"],
  },
  {
    name: "@kysoql/codegen",
    workspacePath: "packages/codegen",
    internalDependencies: ["@kysoql/auth", "@kysoql/rest"],
  },
] as const satisfies readonly ReleasePackageDefinition[];

const VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/u;

export interface ParsedReleaseVersion {
  readonly version: string;
  readonly base: string;
  readonly beta?: string;
  readonly distTag: "latest" | "beta";
}

export const parseReleaseVersion = (version: string): ParsedReleaseVersion => {
  const match = VERSION_PATTERN.exec(version);
  if (match?.[0] !== version) {
    throw new Error(`Invalid or unsupported release version: ${version}`);
  }

  const beta = match[4];
  return {
    version,
    base: `${match[1]}.${match[2]}.${match[3]}`,
    ...(beta === undefined ? {} : { beta }),
    distTag: beta === undefined ? "latest" : "beta",
  };
};

export const versionFromReleaseTag = (tag: string): string => {
  if (!tag.startsWith("v")) {
    throw new Error(`Invalid release tag: ${tag}`);
  }
  return parseReleaseVersion(tag.slice(1)).version;
};

export const releaseTag = (version: string): string =>
  `v${parseReleaseVersion(version).version}`;

export interface ReleaseArtifact {
  readonly file: string;
  readonly manifest: Readonly<Record<string, unknown>>;
}

type JsonObject = Readonly<Record<string, unknown>>;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readStringRecord = (
  value: unknown,
  context: string,
): Readonly<Record<string, string>> => {
  if (!isJsonObject(value)) {
    throw new Error(`${context} must be an object`);
  }

  const entries = Object.entries(value);
  if (!entries.every(([, entry]) => typeof entry === "string")) {
    throw new Error(`${context} must contain only string values`);
  }
  return Object.fromEntries(entries) as Readonly<Record<string, string>>;
};

const validateInternalDependencies = (
  definition: ReleasePackageDefinition,
  manifest: JsonObject,
  version: string,
): void => {
  const found = new Map<string, string>();
  for (const section of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
  ] as const) {
    const value = manifest[section];
    if (value === undefined) {
      continue;
    }
    const dependencies = readStringRecord(
      value,
      `${definition.name}.${section}`,
    );
    for (const [name, specifier] of Object.entries(dependencies)) {
      if (!name.startsWith(`${NPM_SCOPE}/`)) {
        continue;
      }
      if (found.has(name)) {
        throw new Error(
          `${definition.name} declares ${name} in more than one dependency ` +
            "section",
        );
      }
      if (specifier !== version) {
        throw new Error(
          `${definition.name} must pin ${name} to ${version}; found ` +
            specifier,
        );
      }
      found.set(name, specifier);
    }
  }

  const expected = [...definition.internalDependencies].sort();
  const actual = [...found.keys()].sort();
  if (
    expected.length !== actual.length ||
    expected.some((name, index) => name !== actual[index])
  ) {
    throw new Error(
      `${definition.name} internal dependency set does not match the ` +
        "release graph",
    );
  }
};

/** Validate the complete release before publishing any package. */
export const planRelease = (
  artifacts: readonly ReleaseArtifact[],
  version: string,
): readonly ReleaseArtifact[] => {
  parseReleaseVersion(version);
  if (artifacts.length !== RELEASE_PACKAGES.length) {
    throw new Error(
      `Expected ${RELEASE_PACKAGES.length} release packages, found ` +
        artifacts.length,
    );
  }

  const definitions = new Map<string, ReleasePackageDefinition>();
  for (const definition of RELEASE_PACKAGES) {
    definitions.set(definition.name, definition);
  }
  const byName = new Map<string, ReleaseArtifact>();

  for (const artifact of artifacts) {
    const name = artifact.manifest.name;
    const actualVersion = artifact.manifest.version;
    if (
      typeof name !== "string" ||
      !name.startsWith(`${NPM_SCOPE}/`) ||
      !definitions.has(name) ||
      byName.has(name)
    ) {
      throw new Error(`Unexpected or duplicate package: ${String(name)}`);
    }
    if (actualVersion !== version) {
      throw new Error(`Version mismatch for ${name}`);
    }
    if (artifact.manifest.private === true) {
      throw new Error(`${name} must not be private`);
    }

    const definition = definitions.get(name);
    if (definition === undefined) {
      throw new Error(`Missing release definition for ${name}`);
    }
    validateInternalDependencies(definition, artifact.manifest, version);
    byName.set(name, artifact);
  }

  return RELEASE_PACKAGES.map((definition) => {
    const artifact = byName.get(definition.name);
    if (artifact === undefined) {
      throw new Error(`Missing package: ${definition.name}`);
    }
    return artifact;
  });
};
