import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  generateSchema,
  loadSchema,
  renderSchema,
  type SalesforceDescribeClient,
  type SalesforceObjectDescription,
} from "../src/index.js";

const account: SalesforceObjectDescription = {
  name: "Account",
  fields: [
    {
      name: "Name",
      type: "string",
      nillable: false,
      filterable: true,
      sortable: true,
      groupable: true,
    },
    {
      name: "Id",
      type: "id",
      nillable: false,
      filterable: true,
      sortable: true,
      groupable: true,
    },
  ],
  childRelationships: [
    {
      childSObject: "Kysoql_Record__c",
      field: "Account__c",
      relationshipName: "Kysoql_Records__r",
    },
  ],
};

const kysoqlRecord: SalesforceObjectDescription = {
  name: "Kysoql_Record__c",
  fields: [
    {
      name: "Category__c",
      type: "picklist",
      nillable: true,
      filterable: true,
      sortable: true,
      groupable: true,
      picklistValues: [
        { value: "Gamma", active: true },
        { value: "Alpha", active: true },
        { value: "Retired", active: false },
      ],
    },
    {
      name: "Account__c",
      type: "reference",
      nillable: true,
      filterable: true,
      sortable: true,
      groupable: true,
      referenceTo: ["Account"],
      relationshipName: "Account__r",
    },
    {
      name: "Amount__c",
      type: "double",
      nillable: true,
      filterable: true,
      sortable: true,
      groupable: true,
    },
    {
      name: "Active__c",
      type: "boolean",
      nillable: false,
      filterable: true,
      sortable: true,
      groupable: true,
    },
  ],
};

const createClient = (): SalesforceDescribeClient => ({
  describeGlobal: vi.fn(async () => ({
    sobjects: [
      { name: "Contact", queryable: false },
      { name: "Kysoql_Record__c", queryable: true },
      { name: "Account", queryable: true },
    ],
  })),
  describe: vi.fn(async (objectName: string) => {
    if (objectName === "Account") {
      return account;
    }
    if (objectName === "Kysoql_Record__c") {
      return kysoqlRecord;
    }
    throw new Error(`Unexpected object: ${objectName}`);
  }),
});

describe("loadSchema", () => {
  it("loads queryable objects in deterministic order", async () => {
    const client = createClient();

    await expect(loadSchema(client)).resolves.toEqual([account, kysoqlRecord]);
    expect(client.describe).toHaveBeenNthCalledWith(1, "Account");
    expect(client.describe).toHaveBeenNthCalledWith(2, "Kysoql_Record__c");
  });

  it("rejects requested objects that are not queryable", async () => {
    await expect(loadSchema(createClient(), ["Contact"])).rejects.toThrow(
      "Unknown or non-queryable Salesforce object(s): Contact",
    );
  });
});

describe("renderSchema", () => {
  it("renders field capabilities, picklists, and relationships", () => {
    const source = renderSchema([kysoqlRecord, account]);

    expect(source).toContain('readonly "Amount__c": SalesforceField<');
    expect(source).toContain("      number,");
    expect(source).toContain('"Alpha" | "Gamma"');
    expect(source).not.toContain("Retired");
    expect(source).toContain(
      'readonly "Account__r": SalesforceParentRelationship<',
    );
    expect(source).toContain(
      'readonly "Kysoql_Records__r": SalesforceChildRelationship<',
    );
    expect(source.indexOf('readonly "Account"')).toBeLessThan(
      source.indexOf('readonly "Kysoql_Record__c"'),
    );
  });
});

describe("generateSchema", () => {
  it("writes the rendered schema to disk", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kysoql-codegen-"));
    const output = join(directory, "salesforce.generated.ts");

    try {
      await generateSchema({
        client: createClient(),
        objects: ["Kysoql_Record__c"],
        output,
      });

      const source = await readFile(output, "utf8");
      expect(source).toContain("export interface SalesforceSchema");
      expect(source).toContain('readonly "Kysoql_Record__c"');
      expect(source).not.toContain('readonly "Account"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
