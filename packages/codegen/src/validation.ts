import * as v from "valibot";

import type {
  SalesforceGlobalDescription,
  SalesforceObjectDescription,
} from "#/types";

const salesforceGlobalObjectDescriptionSchema = v.object({
  name: v.string(),
  queryable: v.boolean(),
});

const salesforceGlobalDescriptionSchema = v.object({
  sobjects: v.array(salesforceGlobalObjectDescriptionSchema),
});

const salesforcePicklistValueSchema = v.object({
  active: v.optional(v.boolean()),
  value: v.string(),
});

const salesforceFieldDescriptionSchema = v.object({
  name: v.string(),
  type: v.string(),
  nillable: v.boolean(),
  filterable: v.boolean(),
  sortable: v.boolean(),
  groupable: v.boolean(),
  aggregatable: v.boolean(),
  referenceTo: v.optional(v.array(v.string())),
  relationshipName: v.optional(v.nullable(v.string())),
  picklistValues: v.optional(v.array(salesforcePicklistValueSchema)),
});

const salesforceChildRelationshipDescriptionSchema = v.object({
  childSObject: v.string(),
  field: v.string(),
  relationshipName: v.optional(v.nullable(v.string())),
});

const salesforceObjectDescriptionSchema = v.object({
  name: v.string(),
  fields: v.array(salesforceFieldDescriptionSchema),
  childRelationships: v.optional(
    v.array(salesforceChildRelationshipDescriptionSchema),
  ),
});

export const parseGenerateCommand = (input: unknown): "generate" => {
  const result = v.safeParse(
    v.literal("generate", `Unknown command: ${String(input ?? "")}`),
    input,
  );

  if (!result.success) {
    throw new Error(result.issues[0].message);
  }
  return result.output;
};

const generateOptions = ["--object", "--output", "--schema-name"] as const;

type GenerateOption = (typeof generateOptions)[number];

export const parseGenerateOption = (input: unknown): GenerateOption => {
  const result = v.safeParse(
    v.picklist(generateOptions, `Unknown option: ${String(input ?? "")}`),
    input,
  );

  if (!result.success) {
    throw new Error(result.issues[0].message);
  }
  return result.output;
};

export const parseCliValue = (input: unknown, flag: string): string => {
  const message = `${flag} requires a value.`;
  const result = v.safeParse(
    v.pipe(v.string(message), v.nonEmpty(message), v.regex(/^(?!--)/, message)),
    input,
  );

  if (!result.success) {
    throw new Error(result.issues[0].message);
  }
  return result.output;
};

export const parseSchemaName = (input: unknown): string => {
  const result = v.safeParse(
    v.pipe(
      v.string(),
      v.regex(
        /^[A-Za-z_$][A-Za-z0-9_$]*$/,
        `Invalid schema name: ${String(input ?? "")}`,
      ),
    ),
    input,
  );

  if (!result.success) {
    throw new Error(result.issues[0].message);
  }
  return result.output;
};

export const parseRequiredEnvironmentVariable = (
  input: unknown,
  name: string,
): string => {
  const message = `${name} is required.`;
  const result = v.safeParse(
    v.pipe(v.string(message), v.nonEmpty(message)),
    input,
  );

  if (!result.success) {
    throw new Error(result.issues[0].message);
  }
  return result.output;
};

export const parseSalesforceGlobalDescription = (
  input: unknown,
): SalesforceGlobalDescription => {
  const result = v.safeParse(salesforceGlobalDescriptionSchema, input);
  if (!result.success) {
    throw new TypeError(
      `Invalid Salesforce describeGlobal response:\n${v.summarize(result.issues)}`,
    );
  }
  return result.output;
};

export const parseSalesforceObjectDescription = (
  input: unknown,
  objectName: string,
): SalesforceObjectDescription => {
  const result = v.safeParse(salesforceObjectDescriptionSchema, input);
  if (!result.success) {
    throw new TypeError(
      `Invalid Salesforce describe response for ${objectName}:\n${v.summarize(result.issues)}`,
    );
  }

  return {
    name: result.output.name,
    fields: result.output.fields.map((field) => ({
      name: field.name,
      type: field.type,
      nillable: field.nillable,
      filterable: field.filterable,
      sortable: field.sortable,
      groupable: field.groupable,
      aggregatable: field.aggregatable,
      ...(field.referenceTo === undefined
        ? {}
        : { referenceTo: field.referenceTo }),
      ...(field.relationshipName === undefined
        ? {}
        : { relationshipName: field.relationshipName }),
      ...(field.picklistValues === undefined
        ? {}
        : {
            picklistValues: field.picklistValues.map((picklistValue) => ({
              value: picklistValue.value,
              ...(picklistValue.active === undefined
                ? {}
                : { active: picklistValue.active }),
            })),
          }),
    })),
    ...(result.output.childRelationships === undefined
      ? {}
      : {
          childRelationships: result.output.childRelationships.map(
            (relationship) => ({
              childSObject: relationship.childSObject,
              field: relationship.field,
              ...(relationship.relationshipName === undefined
                ? {}
                : { relationshipName: relationship.relationshipName }),
            }),
          ),
        }),
  };
};
