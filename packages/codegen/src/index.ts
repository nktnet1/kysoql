import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { renderSchema } from "#/render";
import {
  parseSalesforceGlobalDescription,
  parseSalesforceObjectDescription,
} from "#/validation";
import type {
  SalesforceDescribeClient,
  SalesforceObjectDescription,
} from "#/types";

export { renderSchema } from "#/render";
export type {
  SalesforceChildRelationshipDescription,
  SalesforceDescribeClient,
  SalesforceFieldDescription,
  SalesforceGlobalDescription,
  SalesforceGlobalObjectDescription,
  SalesforceObjectDescription,
  SalesforcePicklistValue,
} from "#/types";

export interface GenerateSchemaOptions {
  readonly client: SalesforceDescribeClient;
  readonly output: string;
  readonly objects?: readonly string[];
  readonly schemaName?: string;
}

const selectObjectNames = async (
  client: SalesforceDescribeClient,
  requestedObjects: readonly string[] | undefined,
): Promise<readonly string[]> => {
  const globalDescription = parseSalesforceGlobalDescription(
    await client.describeGlobal(),
  );
  const queryableObjects = new Set(
    globalDescription.sobjects
      .filter((object) => object.queryable)
      .map((object) => object.name),
  );

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
): Promise<readonly SalesforceObjectDescription[]> => {
  const objectNames = await selectObjectNames(client, requestedObjects);
  return Promise.all(
    objectNames.map(async (objectName) =>
      parseSalesforceObjectDescription(
        await client.describe(objectName),
        objectName,
      ),
    ),
  );
};

export const generateSchema = async (
  options: GenerateSchemaOptions,
): Promise<void> => {
  const objects = await loadSchema(options.client, options.objects);
  const source = renderSchema(objects, options.schemaName);
  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, source, "utf8");
};
