import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type RestClient, SalesforceRestError } from "@kysoql/rest";
import { describe, it } from "vitest";

import { createRestDescribeClient, generateSchema, loadSchema } from "#/index";
import { field } from "./fixtures/field-filtering.js";

const object = { name: "Account", fields: [field("Id"), field("Name")] };
const global = { sobjects: [{ name: "Account", queryable: true }] };

const transport = (responses: readonly unknown[]) => {
  const paths: string[] = [];
  const client: RestClient = {
    apiVersion: "65.0",
    request: async (path) => {
      paths.push(path);
      assert.ok(
        paths.length <= responses.length,
        "Unexpected Describe request",
      );
      const response = responses[paths.length - 1];
      if (response instanceof Error) {
        throw response;
      }
      return response;
    },
  };
  return { client, paths };
};

describe("native Describe client", () => {
  it("loads metadata through version-relative GET paths and retains field filters", async () => {
    const http = transport([global, object]);
    const schema = await loadSchema(
      createRestDescribeClient(http.client),
      ["Account"],
      { Account: { include: ["Id"] } },
    );
    assert.deepEqual(http.paths, ["/sobjects/", "/sobjects/Account/describe"]);
    assert.deepEqual(
      schema[0]?.fields.map((field) => field.name),
      ["Id"],
    );
    assert.equal(schema[0]?.fieldsComplete, false);
  });

  it("loads ordered big-object index metadata through Tooling API", async () => {
    const bigObject = { name: "EventLog__b", fields: [field("Account__c")] };
    const bigGlobal = {
      sobjects: [{ name: "EventLog__b", queryable: true }],
    };
    const tooling = {
      records: [
        {
          Metadata: {
            indexes: [
              {
                fields: [
                  { name: "Account__c" },
                  { name: "Kind__c" },
                  { name: "CreatedAt__c" },
                ],
              },
            ],
          },
        },
      ],
    };
    const http = transport([bigGlobal, bigObject, tooling]);

    const schema = await loadSchema(createRestDescribeClient(http.client), [
      "EventLog__b",
    ]);

    assert.deepEqual(schema[0]?.bigObjectIndex, [
      "Account__c",
      "Kind__c",
      "CreatedAt__c",
    ]);
    assert.equal(http.paths[0], "/sobjects/");
    assert.equal(http.paths[1], "/sobjects/EventLog__b/describe");
    assert.match(http.paths[2] ?? "", /^\/tooling\/query\/\?q=/);
  });

  it("also accepts native connection options rather than a custom RestClient", async () => {
    const urls: string[] = [];
    const fetch: typeof globalThis.fetch = async (input) => {
      urls.push(String(input));
      return Response.json(global);
    };
    const client = createRestDescribeClient({
      instanceUrl: "https://example.my.salesforce.com",
      accessToken: "token",
      apiVersion: "67.0",
      fetch,
    });
    assert.deepEqual(await client.describeGlobal(), global);
    assert.deepEqual(urls, [
      "https://example.my.salesforce.com/services/data/v67.0/sobjects/",
    ]);
  });

  it("validates global metadata instead of casting untrusted JSON", async () => {
    const http = transport([
      { sobjects: [{ name: "Account", queryable: "yes" }] },
    ]);
    await assert.rejects(
      createRestDescribeClient(http.client).describeGlobal(),
      /describeGlobal response/,
    );
  });

  it("rejects wrong-object responses even when their shape is valid", async () => {
    const http = transport([{ ...object, name: "Contact" }]);
    await assert.rejects(
      createRestDescribeClient(http.client).describe("Account"),
      /different object/,
    );
  });

  it("rejects invalid object names before they become URL paths", async () => {
    const http = transport([]);
    await assert.rejects(
      createRestDescribeClient(http.client).describe("../query"),
      /API name/,
    );
    assert.equal(http.paths.length, 0);
  });

  it("shares a complete, validated Knowledge taxonomy across Knowledge objects", async () => {
    const groups = {
      categoryGroups: [
        {
          name: "Products__c",
          topCategories: [
            { name: "All", childCategories: [{ name: "Software__c" }] },
          ],
        },
      ],
    };
    const http = transport([groups]);
    const client = createRestDescribeClient(http.client);
    const results = await Promise.all([
      client.describeDataCategoryGroups?.("FAQ__kav"),
      client.describeDataCategoryGroups?.("KnowledgeArticleVersion"),
    ]);
    assert.deepEqual(results, [groups, groups]);
    assert.deepEqual(http.paths, [
      "/support/dataCategoryGroups?sObjectName=KnowledgeArticleVersion&topCategoriesOnly=false",
    ]);
    assert.equal(
      await client.describeDataCategoryGroups?.("Account"),
      undefined,
    );
    assert.equal(http.paths.length, 1);
  });

  it("does not retain rejected Knowledge cache promises", async () => {
    const error = new SalesforceRestError(403, []);
    const http = transport([error, { categoryGroups: [] }]);
    const client = createRestDescribeClient(http.client);
    await assert.rejects(
      async () => client.describeDataCategoryGroups?.("FAQ__kav"),
      (cause) => cause === error,
    );
    assert.deepEqual(await client.describeDataCategoryGroups?.("FAQ__kav"), {
      categoryGroups: [],
    });
    assert.equal(http.paths.length, 2);
  });

  it("rejects malformed category descendants rather than generating incomplete types", async () => {
    const http = transport([
      {
        categoryGroups: [
          {
            name: "Group__c",
            topCategories: [{ name: "All", childCategories: [{ name: 42 }] }],
          },
        ],
      },
    ]);
    await assert.rejects(
      async () =>
        createRestDescribeClient(http.client).describeDataCategoryGroups?.(
          "FAQ__kav",
        ),
      /data category response/,
    );
  });

  it("keeps the existing output file intact after an invalid REST Describe response", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kysoql-rest-describe-"));
    const output = join(directory, "schema.ts");
    try {
      await writeFile(output, "original");
      const http = transport([
        global,
        { name: "Account", fields: [{ name: "Id" }] },
      ]);
      await assert.rejects(
        generateSchema({
          client: createRestDescribeClient(http.client),
          objects: ["Account"],
          output,
        }),
        /describe response/,
      );
      assert.equal(await readFile(output, "utf8"), "original");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
