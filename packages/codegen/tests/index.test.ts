import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  generateSchema,
  loadSchema,
  renderSchema,
  type SalesforceDescribeClient,
  type SalesforceObjectDescription,
} from "#src/index";

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
      aggregatable: true,
      custom: false,
    },
    {
      name: "Id",
      type: "id",
      nillable: false,
      filterable: true,
      sortable: true,
      groupable: true,
      aggregatable: true,
      custom: false,
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
      aggregatable: true,
      custom: true,
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
      aggregatable: true,
      custom: true,
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
      aggregatable: true,
      custom: true,
    },
    {
      name: "Active__c",
      type: "boolean",
      nillable: false,
      filterable: true,
      sortable: true,
      groupable: true,
      aggregatable: true,
      custom: true,
    },
  ],
};

const createClient = (): SalesforceDescribeClient => ({
  describeGlobal: vi.fn(async () => ({
    sobjects: [
      { name: "Contact", queryable: false },
      { name: "Kysoql_Record__c", queryable: true },
      { name: "Account", queryable: true },
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
  it("loads every queryable object once in deterministic order", async () => {
    const client = createClient();

    await expect(loadSchema(client)).resolves.toEqual([account, kysoqlRecord]);
    expect(client.describeGlobal).toHaveBeenCalledOnce();
    expect(client.describe).toHaveBeenNthCalledWith(1, "Account");
    expect(client.describe).toHaveBeenNthCalledWith(2, "Kysoql_Record__c");
    expect(client.describe).toHaveBeenCalledTimes(2);
  });

  it("loads and validates optional data-category metadata per object", async () => {
    const client = createClient();
    client.describeDataCategoryGroups = vi.fn(async (objectName: string) =>
      objectName === "Account"
        ? {
            categoryGroups: [
              {
                name: "Geography__c",
                topCategories: [
                  {
                    name: "All",
                    childCategories: [{ name: "usa__c" }],
                  },
                ],
              },
            ],
          }
        : undefined,
    );

    await expect(loadSchema(client, ["Account"])).resolves.toEqual([
      {
        ...account,
        dataCategoryGroups: [
          { name: "Geography__c", categories: ["All", "usa__c"] },
        ],
      },
    ]);
    expect(client.describeDataCategoryGroups).toHaveBeenCalledOnce();
    expect(client.describeDataCategoryGroups).toHaveBeenCalledWith("Account");
  });

  it("leaves object metadata unchanged when category discovery returns undefined", async () => {
    const client = createClient();
    client.describeDataCategoryGroups = vi.fn(async () => undefined);

    await expect(loadSchema(client, ["Account"])).resolves.toEqual([account]);
  });

  it("treats an empty object filter as all queryable objects", async () => {
    const client = createClient();

    await expect(loadSchema(client, [])).resolves.toEqual([
      account,
      kysoqlRecord,
    ]);
    expect(client.describe).toHaveBeenCalledTimes(2);
  });

  it("returns an empty schema when Salesforce exposes no queryable objects", async () => {
    const client = createClient();
    vi.mocked(client.describeGlobal).mockResolvedValueOnce({
      sobjects: [{ name: "Contact", queryable: false }],
    });

    await expect(loadSchema(client)).resolves.toEqual([]);
    expect(client.describeGlobal).toHaveBeenCalledOnce();
    expect(client.describe).not.toHaveBeenCalled();
  });

  it("deduplicates and sorts requested object filters", async () => {
    const client = createClient();

    await expect(
      loadSchema(client, ["Kysoql_Record__c", "Account", "Account"]),
    ).resolves.toEqual([account, kysoqlRecord]);
    expect(client.describe).toHaveBeenNthCalledWith(1, "Account");
    expect(client.describe).toHaveBeenNthCalledWith(2, "Kysoql_Record__c");
    expect(client.describe).toHaveBeenCalledTimes(2);
  });

  it("loads only explicitly requested queryable objects", async () => {
    const client = createClient();

    await expect(loadSchema(client, ["Kysoql_Record__c"])).resolves.toEqual([
      kysoqlRecord,
    ]);
    expect(client.describe).toHaveBeenCalledOnce();
    expect(client.describe).toHaveBeenCalledWith("Kysoql_Record__c");
  });

  it("rejects every requested object that is not queryable before describing any object", async () => {
    const client = createClient();

    await expect(
      loadSchema(client, ["Contact", "Missing__c", "Contact"]),
    ).rejects.toThrow(
      "Unknown or non-queryable Salesforce object(s): Contact, Missing__c",
    );
    expect(client.describe).not.toHaveBeenCalled();
  });

  it("rejects malformed describeGlobal responses before describing objects", async () => {
    const client = createClient();
    vi.mocked(client.describeGlobal).mockResolvedValueOnce({
      sobjects: [{ name: "Account", queryable: "yes" }],
    } as never);

    await expect(loadSchema(client)).rejects.toThrow(
      /Invalid Salesforce describeGlobal response:[\s\S]*sobjects\.0\.queryable/,
    );
    expect(client.describe).not.toHaveBeenCalled();
  });

  it("propagates describeGlobal failures without describing objects", async () => {
    const client = createClient();
    vi.mocked(client.describeGlobal).mockRejectedValueOnce(
      new Error("global describe failed"),
    );

    await expect(loadSchema(client)).rejects.toThrow("global describe failed");
    expect(client.describe).not.toHaveBeenCalled();
  });

  it("rejects malformed object descriptions with the object name and field path", async () => {
    const client = createClient();
    vi.mocked(client.describe).mockResolvedValueOnce({
      name: "Account",
      fields: [
        {
          name: "Id",
          type: "id",
          nillable: false,
          sortable: true,
          groupable: true,
          aggregatable: true,
          custom: false,
        },
      ],
    } as never);

    await expect(loadSchema(client, ["Account"])).rejects.toThrow(
      /Invalid Salesforce describe response for Account:[\s\S]*fields\.0\.filterable/,
    );
  });

  it("requires aggregate capability metadata on described fields", async () => {
    const client = createClient();
    vi.mocked(client.describe).mockResolvedValueOnce({
      name: "Account",
      fields: [
        {
          name: "Id",
          type: "id",
          nillable: false,
          filterable: true,
          sortable: true,
          groupable: true,
          custom: false,
        },
      ],
    } as never);

    await expect(loadSchema(client, ["Account"])).rejects.toThrow(
      /Invalid Salesforce describe response for Account:[\s\S]*fields\.0\.aggregatable/,
    );
  });

  it("requires custom-field metadata on described fields", async () => {
    const client = createClient();
    vi.mocked(client.describe).mockResolvedValueOnce({
      name: "Account",
      fields: [
        {
          name: "Id",
          type: "id",
          nillable: false,
          filterable: true,
          sortable: true,
          groupable: true,
          aggregatable: true,
        },
      ],
    } as never);

    await expect(loadSchema(client, ["Account"])).rejects.toThrow(
      /Invalid Salesforce describe response for Account:[\s\S]*fields\.0\.custom/,
    );
  });

  it("accepts Salesforce describe responses with unused extra properties", async () => {
    const client = createClient();
    vi.mocked(client.describeGlobal).mockResolvedValueOnce({
      encoding: "UTF-8",
      maxBatchSize: 200,
      sobjects: [
        {
          keyPrefix: "001",
          name: "Account",
          queryable: true,
        },
      ],
    } as never);
    vi.mocked(client.describe).mockResolvedValueOnce({
      ...account,
      activateable: false,
      fields: account.fields.map((field) => ({
        ...field,
        label: field.name,
      })),
    } as never);

    await expect(loadSchema(client, ["Account"])).resolves.toEqual([account]);
  });

  it("propagates describe failures", async () => {
    const client = createClient();
    vi.mocked(client.describe).mockRejectedValueOnce(
      new Error("describe failed"),
    );

    await expect(loadSchema(client, ["Account"])).rejects.toThrow(
      "describe failed",
    );
  });
});

describe("renderSchema public export", () => {
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
  it("creates nested output directories and writes the requested custom schema", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kysoql-codegen-"));
    const output = join(directory, "nested", "salesforce.generated.ts");

    try {
      await generateSchema({
        client: createClient(),
        objects: ["Kysoql_Record__c"],
        output,
        schemaName: "GeneratedSchema",
      });

      const source = await readFile(output, "utf8");
      expect(source).toContain("export interface GeneratedSchema");
      expect(source).toContain('readonly "Kysoql_Record__c"');
      expect(source).not.toContain('readonly "Account"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("uses the default schema name when none is supplied", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kysoql-codegen-"));
    const output = join(directory, "salesforce.generated.ts");

    try {
      await generateSchema({
        client: createClient(),
        objects: ["Account"],
        output,
      });

      const source = await readFile(output, "utf8");
      expect(source).toContain("export interface SalesforceSchema");
      expect(source).toContain('readonly "Account"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("field-filtered generation", () => {
  it("applies rules after Describe without adding objects or API calls", async () => {
    const client = createClient();
    const objects = await loadSchema(client, ["Account"], {
      Account: { include: ["Id"] },
      // Valid object, but not selected: do not Describe or validate its fields.
      Kysoql_Record__c: { include: ["NotDescribed"] },
    });
    expect(objects[0]?.fields.map((field) => field.name)).toEqual(["Id"]);
    expect(objects[0]?.fieldsComplete).toBe(false);
    expect(client.describeGlobal).toHaveBeenCalledOnce();
    expect(client.describe).toHaveBeenCalledOnce();
    expect(client.describe).toHaveBeenCalledWith("Account");
  });

  it("applies rules when objects are discovered rather than explicitly listed", async () => {
    const objects = await loadSchema(createClient(), undefined, {
      Account: { exclude: ["Name"] },
    });
    expect(objects.map((object) => object.name)).toEqual([
      "Account",
      "Kysoql_Record__c",
    ]);
    expect(objects[0]?.fields.map((field) => field.name)).toEqual(["Id"]);
    expect(objects[1]?.fieldsComplete).toBeUndefined();
  });

  it("validates malformed API options before Describe", async () => {
    const client = createClient();
    await expect(
      loadSchema(client, ["Account"], { Account: { include: [] } }),
    ).rejects.toThrow(/fields\.Account\.include/);
    expect(client.describeGlobal).not.toHaveBeenCalled();
    expect(client.describe).not.toHaveBeenCalled();
  });

  it.each(["Accont", "Contact"])(
    "rejects unknown or non-queryable rule object %s",
    async (objectName) => {
      const client = createClient();
      await expect(
        loadSchema(client, ["Account"], { [objectName]: { include: ["Id"] } }),
      ).rejects.toThrow(
        `Unknown or non-queryable Salesforce object(s) in field filters: fields.${objectName}`,
      );
      expect(client.describeGlobal).toHaveBeenCalledOnce();
      expect(client.describe).not.toHaveBeenCalled();
    },
  );

  it("reports unknown or unavailable fields in the selected object's Describe", async () => {
    await expect(
      loadSchema(createClient(), ["Account"], {
        Account: { include: ["Id", "Missing"] },
      }),
    ).rejects.toThrow(
      /fields\.Account\.include: unknown or unavailable field\(s\): "Missing"/,
    );
  });

  it("keeps retained Knowledge metadata when filtering fields", async () => {
    const client = createClient();
    client.describeDataCategoryGroups = vi.fn(async () => ({
      categoryGroups: [{ name: "Region", topCategories: [{ name: "All" }] }],
    }));
    const objects = await loadSchema(client, ["Account"], {
      Account: { include: ["Id"] },
    });
    expect(objects[0]?.dataCategoryGroups).toEqual([
      { name: "Region", categories: ["All"] },
    ]);
  });

  it("writes a filtered schema and leaves an existing file untouched on validation errors", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kysoql-fields-"));
    const output = join(directory, "schema.ts");
    try {
      await generateSchema({
        client: createClient(),
        output,
        objects: ["Account"],
        fields: { Account: { include: ["Id"] } },
      });
      const source = await readFile(output, "utf8");
      expect(source).toContain('readonly "Id": SalesforceField<');
      expect(source).not.toContain('readonly "Name": SalesforceField<');
      expect(source).toContain('    "none",\n    false\n  >;');
      await writeFile(output, "previous schema");
      await expect(
        generateSchema({
          client: createClient(),
          output,
          objects: ["Account"],
          fields: { Account: { exclude: ["Id", "Name"] } },
        }),
      ).rejects.toThrow(/removes every field/);
      expect(await readFile(output, "utf8")).toBe("previous schema");
      await expect(
        generateSchema({
          client: createClient(),
          output,
          objects: ["Account"],
          fields: { Account: { include: ["Missing"] } },
        }),
      ).rejects.toThrow(/unknown or unavailable/);
      expect(await readFile(output, "utf8")).toBe("previous schema");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
