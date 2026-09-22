import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { ObjectFieldFilters } from "#/config";
import { applyFieldFilters, parseFieldFilters } from "#/field-filters";
import { renderSchema } from "#/render";
import type {
  SalesforceDescribeClient,
  SalesforceObjectDescription,
} from "#/types";
import {
  parseSalesforceDataCategoryGroupsResponse,
  parseSalesforceGlobalDescription,
  parseSalesforceObjectDescription,
} from "#/validation";

export {
  defineConfig,
  type KysoqlConfig,
  type ObjectFieldFilter,
  type ObjectFieldFilters,
} from "#/config";
export { renderSchema } from "#/render";
export type {
  SalesforceChildRelationshipDescription,
  SalesforceDataCategoryGroupDescription,
  SalesforceDataCategoryGroupResponse,
  SalesforceDataCategoryGroupsResponse,
  SalesforceDataCategorySummaryResponse,
  SalesforceDescribeClient,
  SalesforceFieldDescription,
  SalesforceGlobalDescription,
  SalesforceGlobalObjectDescription,
  SalesforceObjectDescription,
  SalesforcePicklistValue,
  SalesforceSupportedScopeDescription,
} from "#/types";

export interface GenerateSchemaOptions {
  readonly client: SalesforceDescribeClient;
  readonly output: string;
  readonly objects?: readonly string[];
  readonly fields?: ObjectFieldFilters;
  readonly schemaName?: string;
}

const selectObjectNames = async (
  client: SalesforceDescribeClient,
  requestedObjects: readonly string[] | undefined,
  fields: ObjectFieldFilters,
): Promise<readonly string[]> => {
  const globalDescription = parseSalesforceGlobalDescription(
    await client.describeGlobal(),
  );
  const queryableObjects = new Set(
    globalDescription.sobjects
      .filter((object) => object.queryable)
      .map((object) => object.name),
  );

  const unknownRules = Object.keys(fields)
    .filter((objectName) => !queryableObjects.has(objectName))
    .sort();
  if (unknownRules.length > 0) {
    throw new Error(
      "Unknown or non-queryable Salesforce object(s) in field filters: " +
        unknownRules.map((name) => `fields.${name}`).join(", "),
    );
  }

  if (!requestedObjects?.length) {
    return [...queryableObjects].sort((left, right) =>
      left.localeCompare(right),
    );
  }

  const uniqueRequestedObjects = [...new Set(requestedObjects)];
  const missingObjects = uniqueRequestedObjects.filter(
    (objectName) => !queryableObjects.has(objectName),
  );

  if (missingObjects.length > 0) {
    throw new Error(
      `Unknown or non-queryable Salesforce object(s): ${missingObjects.join(", ")}`,
    );
  }

  return uniqueRequestedObjects.sort((left, right) =>
    left.localeCompare(right),
  );
};

export const loadSchema = async (
  client: SalesforceDescribeClient,
  requestedObjects?: readonly string[],
  fields?: ObjectFieldFilters,
): Promise<readonly SalesforceObjectDescription[]> => {
  // Reject malformed rules before making any network requests.
  const filters = fields === undefined ? {} : parseFieldFilters(fields);
  const objectNames = await selectObjectNames(client, requestedObjects, filters);
  const objects = await Promise.all(
    objectNames.map(async (objectName) => {
      const object = parseSalesforceObjectDescription(
        await client.describe(objectName),
        objectName,
      );
      const dataCategoryResponse =
        await client.describeDataCategoryGroups?.(objectName);

      if (dataCategoryResponse === undefined) {
        return object;
      }

      return {
        ...object,
        dataCategoryGroups: parseSalesforceDataCategoryGroupsResponse(
          dataCategoryResponse,
          objectName,
        ),
      };
    }),
  );
  return applyFieldFilters(objects, filters);
};

export const generateSchema = async (
  options: GenerateSchemaOptions,
): Promise<void> => {
  const objects = await loadSchema(
    options.client,
    options.objects,
    options.fields,
  );
  const source = renderSchema(objects, options.schemaName);
  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, source, "utf8");
};
