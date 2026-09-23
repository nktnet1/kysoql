import * as v from "valibot";

import type {
  SalesforceDataCategoryGroupDescription,
  SalesforceDataCategoryGroupsResponse,
  SalesforceDataCategorySummaryResponse,
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
  custom: v.boolean(),
  referenceTo: v.optional(v.array(v.string())),
  relationshipName: v.optional(v.nullable(v.string())),
  namePointing: v.optional(v.boolean()),
  polymorphicForeignKey: v.optional(v.boolean()),
  picklistValues: v.optional(v.array(salesforcePicklistValueSchema)),
});

const salesforceChildRelationshipDescriptionSchema = v.object({
  childSObject: v.string(),
  field: v.string(),
  relationshipName: v.optional(v.nullable(v.string())),
});

const salesforceSupportedScopeDescriptionSchema = v.object({
  name: v.string(),
});

const salesforceDataCategorySummarySchema = v.object({
  name: v.string(),
  childCategories: v.optional(v.nullable(v.array(v.unknown()))),
});

const salesforceDataCategoryGroupSchema = v.object({
  name: v.string(),
  topCategories: v.array(v.unknown()),
});

const salesforceDataCategoryGroupsResponseSchema = v.object({
  categoryGroups: v.array(v.unknown()),
});

const salesforceObjectDescriptionSchema = v.object({
  name: v.string(),
  fields: v.array(salesforceFieldDescriptionSchema),
  mruEnabled: v.optional(v.boolean()),
  childRelationships: v.optional(
    v.array(salesforceChildRelationshipDescriptionSchema),
  ),
  supportedScopes: v.optional(
    v.array(salesforceSupportedScopeDescriptionSchema),
  ),
});

const parseDataCategorySummary = (
  input: unknown,
  objectName: string,
): SalesforceDataCategorySummaryResponse => {
  const result = v.safeParse(salesforceDataCategorySummarySchema, input);
  if (!result.success) {
    throw new TypeError(
      `Invalid Salesforce data category response for ${objectName}:\n${v.summarize(result.issues)}`,
    );
  }

  return {
    name: result.output.name,
    ...(result.output.childCategories === undefined
      ? {}
      : {
          childCategories:
            result.output.childCategories === null
              ? null
              : result.output.childCategories.map((category) =>
                  parseDataCategorySummary(category, objectName),
                ),
        }),
  };
};

const collectDataCategoryNames = (
  categories: readonly SalesforceDataCategorySummaryResponse[],
  names: Set<string>,
): void => {
  for (const category of categories) {
    names.add(category.name);
    if (category.childCategories) {
      collectDataCategoryNames(category.childCategories, names);
    }
  }
};

/** Validate and retain the REST tree for native/custom Describe clients. */
export const parseSalesforceDataCategoryGroups = (
  input: unknown,
  objectName: string,
): SalesforceDataCategoryGroupsResponse => {
  const response = v.safeParse(
    salesforceDataCategoryGroupsResponseSchema,
    input,
  );
  if (!response.success) {
    throw new TypeError(
      `Invalid Salesforce data category response for ${objectName}:\n${v.summarize(response.issues)}`,
    );
  }
  return {
    categoryGroups: response.output.categoryGroups.map((input) => {
      const group = v.safeParse(salesforceDataCategoryGroupSchema, input);
      if (!group.success) {
        throw new TypeError(
          `Invalid Salesforce data category response for ${objectName}:\n${v.summarize(group.issues)}`,
        );
      }
      return {
        name: group.output.name,
        topCategories: group.output.topCategories.map((category) =>
          parseDataCategorySummary(category, objectName),
        ),
      };
    }),
  };
};

export const parseSalesforceDataCategoryGroupsResponse = (
  input: unknown,
  objectName: string,
): readonly SalesforceDataCategoryGroupDescription[] => {
  const response = parseSalesforceDataCategoryGroups(input, objectName);
  const groups = new Map<string, Set<string>>();
  for (const group of response.categoryGroups) {
    const names = groups.get(group.name) ?? new Set<string>();
    collectDataCategoryNames(group.topCategories, names);
    groups.set(group.name, names);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, categories]) => ({
      name,
      categories: [...categories].sort((left, right) =>
        left.localeCompare(right),
      ),
    }));
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

const generateEnvironmentSchema = v.object({
  SF_ACCESS_TOKEN: v.pipe(
    v.string("SF_ACCESS_TOKEN is required."),
    v.trim(),
    v.nonEmpty("SF_ACCESS_TOKEN is required."),
  ),
  SF_INSTANCE_URL: v.pipe(
    v.string("SF_INSTANCE_URL is required."),
    v.trim(),
    v.nonEmpty("SF_INSTANCE_URL is required."),
    v.url("SF_INSTANCE_URL must be a valid URL."),
  ),
  SF_API_VERSION: v.optional(
    v.pipe(
      v.string("SF_API_VERSION must be a string."),
      v.trim(),
      v.nonEmpty("SF_API_VERSION must not be empty."),
    ),
  ),
});

export const parseGenerateEnvironment = (input: unknown) => {
  const result = v.safeParse(generateEnvironmentSchema, input);
  if (!result.success) {
    throw new Error(
      result.issues[0]?.message ?? "Invalid codegen environment.",
    );
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
      custom: field.custom,
      ...(field.referenceTo === undefined
        ? {}
        : { referenceTo: field.referenceTo }),
      ...(field.relationshipName === undefined
        ? {}
        : { relationshipName: field.relationshipName }),
      ...(field.namePointing === undefined
        ? {}
        : { namePointing: field.namePointing }),
      ...(field.polymorphicForeignKey === undefined
        ? {}
        : { polymorphicForeignKey: field.polymorphicForeignKey }),
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
    ...(result.output.mruEnabled === undefined
      ? {}
      : { mruEnabled: result.output.mruEnabled }),
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
    ...(result.output.supportedScopes === undefined
      ? {}
      : {
          supportedScopes: result.output.supportedScopes.map((scope) => ({
            name: scope.name,
          })),
        }),
  };
};
