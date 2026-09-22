import {
  createRestClient,
  type RestClient,
  type RestClientOptions,
} from "@kysoql/rest";

import type {
  SalesforceDataCategoryGroupsResponse,
  SalesforceDescribeClient,
} from "#/types";
import {
  parseSalesforceDataCategoryGroups,
  parseSalesforceGlobalDescription,
  parseSalesforceObjectDescription,
} from "#/validation";

/** Native metadata transport. No JSforce import or dependency is needed. */
export const createRestDescribeClient = (
  input: RestClient | RestClientOptions,
): SalesforceDescribeClient => {
  const client = "request" in input ? input : createRestClient(input);
  let knowledgeGroups:
    | Promise<SalesforceDataCategoryGroupsResponse>
    | undefined;

  return {
    describeGlobal: async () =>
      parseSalesforceGlobalDescription(await client.request("/sobjects/")),
    describe: async (objectName) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(objectName)) {
        throw new TypeError("Expected a Salesforce object API name.");
      }
      const result = parseSalesforceObjectDescription(
        await client.request(
          `/sobjects/${encodeURIComponent(objectName)}/describe`,
        ),
        objectName,
      );
      if (result.name !== objectName) {
        throw new TypeError(
          "Salesforce Describe returned a different object than requested.",
        );
      }
      return result;
    },
    describeDataCategoryGroups: async (objectName) => {
      if (
        objectName !== "KnowledgeArticleVersion" &&
        !objectName.endsWith("__kav")
      ) {
        return undefined;
      }
      // All Knowledge article-version objects use the same category taxonomy.
      // Share in-flight work, but permit another attempt after a failed request.
      knowledgeGroups ??= client
        .request(
          "/support/dataCategoryGroups?sObjectName=KnowledgeArticleVersion&topCategoriesOnly=false",
        )
        .then((body) => parseSalesforceDataCategoryGroups(body, objectName))
        .catch((error: unknown) => {
          knowledgeGroups = undefined;
          throw error;
        });
      return knowledgeGroups;
    },
  };
};
