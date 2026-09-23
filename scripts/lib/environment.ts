import * as v from "valibot";

const nonEmptyEnvironmentString = (name: string) =>
  v.pipe(
    v.string(`${name} must be a string.`),
    v.trim(),
    v.minLength(1, `${name} must not be empty.`),
  );

const salesforceTargetEnvironmentSchema = v.object({
  KYSOQL_TARGET_ORG: v.optional(
    nonEmptyEnvironmentString("KYSOQL_TARGET_ORG"),
    "kysoql-test",
  ),
});

const salesforceSetupEnvironmentSchema = v.object({
  KYSOQL_DEV_HUB_ALIAS: v.optional(
    nonEmptyEnvironmentString("KYSOQL_DEV_HUB_ALIAS"),
    "kysoql-dev-hub",
  ),
  KYSOQL_SCRATCH_ALIAS: v.optional(
    nonEmptyEnvironmentString("KYSOQL_SCRATCH_ALIAS"),
    "kysoql-test",
  ),
  KYSOQL_SCRATCH_DURATION_DAYS: v.optional(
    v.pipe(
      nonEmptyEnvironmentString("KYSOQL_SCRATCH_DURATION_DAYS"),
      v.regex(
        /^\d+$/u,
        "KYSOQL_SCRATCH_DURATION_DAYS must be an integer between 1 and 30.",
      ),
    ),
    "30",
  ),
});

const schemaGenerationEnvironmentSchema = v.object({
  KYSOQL_TARGET_ORG: v.optional(
    nonEmptyEnvironmentString("KYSOQL_TARGET_ORG"),
  ),
  KYSOQL_SCRATCH_ALIAS: v.optional(
    nonEmptyEnvironmentString("KYSOQL_SCRATCH_ALIAS"),
  ),
});

export const readSalesforceTargetEnvironment = (
  input: NodeJS.ProcessEnv = process.env,
) => {
  const result = v.safeParse(salesforceTargetEnvironmentSchema, input);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${v.summarize(result.issues)}`);
  }
  return result.output;
};

export const readSalesforceSetupEnvironment = (
  input: NodeJS.ProcessEnv = process.env,
) => {
  const result = v.safeParse(salesforceSetupEnvironmentSchema, input);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${v.summarize(result.issues)}`);
  }
  return result.output;
};

export const readSchemaGenerationEnvironment = (
  input: NodeJS.ProcessEnv = process.env,
) => {
  const result = v.safeParse(schemaGenerationEnvironmentSchema, input);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${v.summarize(result.issues)}`);
  }
  return result.output;
};

const durationDaysSchema = v.pipe(
  v.number(),
  v.integer("Scratch duration must be an integer."),
  v.minValue(1, "Scratch duration must be between 1 and 30 days."),
  v.maxValue(30, "Scratch duration must be between 1 and 30 days."),
);

export const parseScratchDurationDays = (input: number | string): number => {
  const numeric = typeof input === "string" ? Number(input) : input;
  const result = v.safeParse(durationDaysSchema, numeric);
  if (!result.success) {
    throw new Error(result.issues[0]?.message ?? "Invalid scratch duration.");
  }
  return result.output;
};
