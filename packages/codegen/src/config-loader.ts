import { stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

import { createJiti } from "jiti";
import * as v from "valibot";

import type { KysoqlConfig, ObjectFieldFilters } from "#/config";
import { parseFieldFilters } from "#/field-filters";
import { parseSchemaName } from "#/validation";

const extensions = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];
const nonBlankString = v.pipe(
  v.string(),
  v.check((value) => value.trim().length > 0, "Expected a non-blank string."),
);
const configSchema = v.strictObject({
  apiVersion: v.optional(
    v.pipe(
      v.string(),
      v.regex(
        /^[1-9]\d*\.0$/,
        'Expected apiVersion such as "65.0", without "v".',
      ),
    ),
  ),
  objects: v.optional(v.array(nonBlankString)),
  // Shared with the programmatic API; validation reports the exact rule path.
  fields: v.optional(v.unknown()),
  output: v.optional(nonBlankString),
  schemaName: v.optional(nonBlankString),
});

export interface LoadedKysoqlConfig {
  readonly filename: string;
  readonly config: KysoqlConfig;
}

export interface LoadConfigOptions {
  readonly cwd?: string | undefined;
  readonly configFile?: string | undefined;
  readonly disabled?: boolean | undefined;
}

export interface GenerateFlagOverrides {
  readonly "api-version"?: string | undefined;
  readonly object?: readonly string[] | undefined;
  readonly output?: string | undefined;
  readonly "schema-name"?: string | undefined;
}

export interface ResolvedGenerateOptions {
  readonly apiVersion?: string;
  readonly objects: readonly string[];
  readonly fields?: ObjectFieldFilters;
  readonly output: string;
  readonly schemaName: string;
}

export const parseKysoqlConfig = (
  input: unknown,
  source = "configuration",
): KysoqlConfig => {
  if (
    input === null ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  ) {
    throw new TypeError(`Invalid Kysoql ${source}: expected a plain object.`);
  }
  const result = v.safeParse(configSchema, input);
  if (!result.success) {
    throw new TypeError(
      `Invalid Kysoql ${source}:\n${v.summarize(result.issues)}`,
    );
  }
  const { apiVersion, objects, fields, output, schemaName } = result.output;
  return {
    ...(apiVersion === undefined ? {} : { apiVersion }),
    ...(objects === undefined ? {} : { objects }),
    ...(fields === undefined
      ? {}
      : { fields: parseFieldFilters(fields, `${source}: fields`) }),
    ...(output === undefined ? {} : { output }),
    ...(schemaName === undefined
      ? {}
      : { schemaName: parseSchemaName(schemaName) }),
  };
};

const isFile = async (filename: string): Promise<boolean> => {
  try {
    if (!(await stat(filename)).isFile()) {
      throw new Error(`Kysoql config is not a file: ${filename}`);
    }
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

/** Look only in cwd; a parent workspace may target a different Salesforce org. */
export const loadConfig = async (
  options: LoadConfigOptions = {},
): Promise<LoadedKysoqlConfig | undefined> => {
  if (options.disabled) {
    if (options.configFile !== undefined) {
      throw new Error("--config and --no-config cannot be used together.");
    }
    return undefined;
  }

  const cwd = resolve(options.cwd ?? process.cwd());
  let filename: string;
  if (options.configFile !== undefined) {
    if (!options.configFile.trim()) {
      throw new Error("--config requires a non-blank path.");
    }
    filename = resolve(cwd, options.configFile);
    if (!extensions.includes(extname(filename))) {
      throw new Error(
        `Unsupported Kysoql config extension: ${filename}. ` +
          `Use ${extensions.join(", ")}.`,
      );
    }
    if (!(await isFile(filename))) {
      throw new Error(`Kysoql config not found: ${filename}`);
    }
  } else {
    const matches: string[] = [];
    for (const extension of extensions) {
      const candidate = resolve(cwd, `kysoql.config${extension}`);
      if (await isFile(candidate)) {
        matches.push(candidate);
      }
    }
    const [first] = matches;
    if (first === undefined) {
      return undefined;
    }
    if (matches.length > 1) {
      throw new Error(
        `Multiple Kysoql config files found: ${matches.join(", ")}. ` +
          "Select one with --config.",
      );
    }
    filename = first;
  }

  let input: unknown;
  try {
    // A loader, rather than native import(), also resolves extensionless TS
    // helpers. Avoid stale configuration between invocations in one process.
    const jiti = createJiti(filename, {
      interopDefault: false,
      moduleCache: false,
      tryNative: false,
    });
    const module = await jiti.import<unknown>(filename);
    if (module !== null && typeof module === "object" && "default" in module) {
      input = module.default;
    } else if ([".cts", ".cjs"].includes(extname(filename))) {
      input = module;
    } else {
      throw new TypeError("Expected a default-exported configuration object.");
    }
  } catch (error) {
    throw new Error(
      `Unable to load Kysoql config ${filename}: ` +
        (error instanceof Error ? error.message : "module evaluation failed"),
      { cause: error },
    );
  }

  return {
    filename,
    config: parseKysoqlConfig(input, `config in ${filename}`),
  };
};

/** CLI values replace configured values; relative CLI paths always use cwd. */
export const resolveGenerateOptions = (
  flags: GenerateFlagOverrides,
  loaded: LoadedKysoqlConfig | undefined,
  cwd = process.cwd(),
): ResolvedGenerateOptions => {
  const config = parseKysoqlConfig({
    ...loaded?.config,
    ...(flags["api-version"] === undefined
      ? {}
      : { apiVersion: flags["api-version"] }),
    ...(flags.object === undefined ? {} : { objects: flags.object }),
    ...(flags.output === undefined ? {} : { output: flags.output }),
    ...(flags["schema-name"] === undefined
      ? {}
      : { schemaName: flags["schema-name"] }),
  });
  const outputDirectory =
    flags.output !== undefined || loaded === undefined
      ? cwd
      : dirname(loaded.filename);

  return {
    ...(config.apiVersion === undefined
      ? {}
      : { apiVersion: config.apiVersion }),
    objects: config.objects ?? [],
    ...(config.fields === undefined ? {} : { fields: config.fields }),
    output: resolve(
      outputDirectory,
      config.output ?? "salesforce.generated.ts",
    ),
    schemaName: config.schemaName ?? "SalesforceSchema",
  };
};
