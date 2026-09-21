import { describe, expect, it } from "vitest";

import { renderSchema } from "#/render";
import type {
  SalesforceFieldDescription,
  SalesforceObjectDescription,
} from "#/types";

const field = (
  overrides: Partial<SalesforceFieldDescription> = {},
): SalesforceFieldDescription => ({
  name: "Field__c",
  type: "string",
  nillable: false,
  filterable: true,
  sortable: true,
  groupable: true,
  aggregatable: true,
  custom: true,
  ...overrides,
});

const objectWith = (
  fields: readonly SalesforceFieldDescription[],
  overrides: Partial<SalesforceObjectDescription> = {},
): SalesforceObjectDescription => ({
  name: "Fixture__c",
  fields,
  ...overrides,
});

describe("renderSchema", () => {
  it.each([
    ["boolean", "boolean"],
    ["currency", "number"],
    ["double", "number"],
    ["int", "number"],
    ["percent", "number"],
    ["base64", "string"],
    ["combobox", "string"],
    ["date", "string"],
    ["datetime", "string"],
    ["email", "string"],
    ["encryptedstring", "string"],
    ["id", "string"],
    ["multipicklist", "string"],
    ["phone", "string"],
    ["picklist", "string"],
    ["reference", "string"],
    ["string", "string"],
    ["textarea", "string"],
    ["time", "string"],
    ["url", "string"],
    ["location", "SalesforceGeolocation"],
  ] as const)("maps Salesforce %s fields to %s values", (type, valueType) => {
    const source = renderSchema([objectWith([field({ type })])]);

    expect(source).toContain(
      `readonly "Field__c": SalesforceField<\n        ${valueType},\n        "${type}",`,
    );
  });

  it("renders every field capability flag exactly as described", () => {
    const source = renderSchema([
      objectWith([
        field({
          nillable: true,
          filterable: false,
          sortable: false,
          groupable: false,
          aggregatable: false,
          custom: false,
        }),
      ]),
    ]);

    expect(source).toContain(
      [
        'readonly "Field__c": SalesforceField<',
        "        string,",
        '        "string",',
        "        true,",
        "        false,",
        "        false,",
        "        false,",
        "        never,",
        "        never,",
        "        never,",
        "        false,",
        "        false,",
        "        false",
      ].join("\n"),
    );
  });

  it("renders active picklist values as a sorted unique string union", () => {
    const source = renderSchema([
      objectWith([
        field({
          type: "picklist",
          picklistValues: [
            { value: "Zulu", active: true },
            { value: "Alpha" },
            { value: "Zulu", active: true },
            { value: "Retired", active: false },
          ],
        }),
      ]),
    ]);

    expect(source).toContain('"Alpha" | "Zulu"');
    expect(source).not.toContain("Retired");
  });

  it("renders active multipicklist values and falls back to never when none are active", () => {
    const withValues = renderSchema([
      objectWith([
        field({
          type: "multipicklist",
          picklistValues: [
            { value: "Beta", active: true },
            { value: "Alpha", active: true },
          ],
        }),
      ]),
    ]);
    const withoutValues = renderSchema([
      objectWith([
        field({
          type: "multipicklist",
          picklistValues: [{ value: "Retired", active: false }],
        }),
      ]),
    ]);

    expect(withValues).toContain('"Alpha" | "Beta"');
    expect(withoutValues).toContain(
      '        "multipicklist",\n        false,\n        true,\n        true,\n        true,\n        never,\n        never,\n        never,\n        true',
    );
  });

  it("does not treat picklist metadata on a non-picklist field as an active-value union", () => {
    const source = renderSchema([
      objectWith([
        field({
          type: "string",
          picklistValues: [{ value: "Unexpected", active: true }],
        }),
      ]),
    ]);

    expect(source).not.toContain("Unexpected");
    expect(source).toContain(
      '        "string",\n        false,\n        true,\n        true,\n        true,\n        never,\n        never,\n        never,\n        true',
    );
  });

  it("renders reference targets and parent relationship metadata as sorted unique unions", () => {
    const source = renderSchema([
      objectWith([
        field({
          name: "Owner__c",
          type: "reference",
          nillable: true,
          referenceTo: ["User", "Account", "User"],
          relationshipName: "Owner__r",
        }),
      ]),
    ]);

    expect(source).toContain(
      '        "Account" | "User",\n        "Owner__r",\n        never,\n        true',
    );
    expect(source).toContain(
      [
        'readonly "Owner__r": SalesforceParentRelationship<',
        '        "Account" | "User",',
        '        "Owner__c",',
        "        true",
      ].join("\n"),
    );
  });

  it("marks only Describe-confirmed multi-target named references as polymorphic", () => {
    const source = renderSchema([
      objectWith([
        field({
          name: "WhatId",
          type: "reference",
          referenceTo: ["Opportunity", "Account", "Account"],
          relationshipName: "What",
          namePointing: true,
          polymorphicForeignKey: true,
        }),
        field({
          name: "OwnerId",
          type: "reference",
          referenceTo: ["User", "Calendar"],
          relationshipName: "Owner",
          namePointing: true,
          polymorphicForeignKey: false,
        }),
        field({
          name: "DuplicateTarget__c",
          type: "reference",
          referenceTo: ["Account", "Account"],
          relationshipName: "DuplicateTarget__r",
          namePointing: true,
          polymorphicForeignKey: true,
        }),
      ]),
    ]);

    const fieldBlock = (name: string): string => {
      const start = source.indexOf(`readonly "${name}": SalesforceField<`);
      const end = source.indexOf("      >;", start);
      return source.slice(start, end).trimEnd();
    };

    expect(fieldBlock("WhatId")).toMatch(/\n {8}true$/);
    expect(fieldBlock("OwnerId")).toMatch(/\n {8}false$/);
    expect(fieldBlock("DuplicateTarget__c")).toMatch(/\n {8}false$/);
  });

  it("renders supported scopes as a sorted unique string-literal union", () => {
    const source = renderSchema([
      objectWith([], {
        supportedScopes: [{ name: "team" }, { name: "mine" }, { name: "team" }],
      }),
    ]);

    expect(source).toContain(
      'readonly "Fixture__c": SalesforceObject<\n    Record<string, never>,\n    Record<string, never>,\n    Record<string, never>,\n    "mine" | "team",\n    Record<string, never>,\n    boolean,\n    "none"\n  >;',
    );
  });

  it("renders exact Describe MRU capability and preserves unknown metadata", () => {
    const enabled = renderSchema([objectWith([], { mruEnabled: true })]);
    const disabled = renderSchema([objectWith([], { mruEnabled: false })]);
    const unknown = renderSchema([objectWith([])]);

    expect(enabled).toContain(
      '    Record<string, never>,\n    true,\n    "none"\n  >;',
    );
    expect(disabled).toContain(
      '    Record<string, never>,\n    false,\n    "none"\n  >;',
    );
    expect(unknown).toContain(
      '    Record<string, never>,\n    boolean,\n    "none"\n  >;',
    );
  });

  it("renders Data 360 SET OPTIONS capability from object API-name suffixes", () => {
    const source = renderSchema([
      objectWith([], { name: "ContactPoint__dll" }),
      objectWith([], { name: "UnifiedIndividual__dlm" }),
      objectWith([], { name: "Account" }),
    ]);

    const objectBlock = (name: string): string => {
      const start = source.indexOf(`readonly "${name}": SalesforceObject<`);
      const end = source.indexOf("  >;", start);
      return source.slice(start, end + 4);
    };

    expect(objectBlock("ContactPoint__dll")).toContain('"data360-dlo"');
    expect(objectBlock("UnifiedIndividual__dlm")).toContain('"data360-dmo"');
    expect(objectBlock("Account")).toContain('"none"');
  });

  it("renders data-category groups as sorted object-specific category unions", () => {
    const source = renderSchema([
      objectWith([], {
        dataCategoryGroups: [
          {
            name: "Product__c",
            categories: ["mobile__c", "All", "mobile__c"],
          },
          {
            name: "Geography__c",
            categories: ["usa__c", "All", "europe__c"],
          },
        ],
      }),
    ]);

    expect(source).toContain(
      [
        "    {",
        '      readonly "Geography__c": "All" | "europe__c" | "usa__c";',
        '      readonly "Product__c": "All" | "mobile__c";',
        "    }",
      ].join("\n"),
    );
    expect(source.indexOf('readonly "Geography__c"')).toBeLessThan(
      source.indexOf('readonly "Product__c"'),
    );
  });

  it("renders a visible category group with no visible categories as never", () => {
    const source = renderSchema([
      objectWith([], {
        dataCategoryGroups: [{ name: "Empty__c", categories: [] }],
      }),
    ]);

    expect(source).toContain('readonly "Empty__c": never;');
  });

  it("JSON-quotes generated names and string-union members", () => {
    const source = renderSchema([
      objectWith(
        [
          field({
            name: 'Quoted"Field__c',
            type: "picklist",
            picklistValues: [
              { value: 'Quoted"Value', active: true },
              { value: "Line\nBreak", active: true },
            ],
          }),
        ],
        { name: 'Quoted"Object__c' },
      ),
    ]);

    expect(source).toContain('readonly "Quoted\\"Object__c"');
    expect(source).toContain('readonly "Quoted\\"Field__c"');
    expect(source).toContain('"Line\\nBreak" | "Quoted\\"Value"');
  });

  it("omits parent relationships unless both relationshipName and referenceTo are present", () => {
    const source = renderSchema([
      objectWith([
        field({
          name: "MissingName__c",
          type: "reference",
          referenceTo: ["Account"],
          relationshipName: null,
        }),
        field({
          name: "MissingTarget__c",
          type: "reference",
          relationshipName: "MissingTarget__r",
        }),
      ]),
    ]);

    expect(source).not.toContain("SalesforceParentRelationship<");
    expect(source).not.toContain('readonly "MissingTarget__r"');
  });

  it("treats an empty reference target list as no relationship metadata", () => {
    const source = renderSchema([
      objectWith([
        field({
          name: "EmptyReference__c",
          type: "reference",
          referenceTo: [],
          relationshipName: "EmptyReference__r",
        }),
      ]),
    ]);

    expect(source).toContain(
      '        "reference",\n        false,\n        true,\n        true,\n        true,\n        never,\n        "EmptyReference__r",\n        never,\n        true',
    );
    expect(source).not.toContain(
      'readonly "EmptyReference__r": SalesforceParentRelationship<',
    );
  });

  it("renders named child relationships in deterministic order and omits unnamed children", () => {
    const source = renderSchema([
      objectWith([], {
        childRelationships: [
          {
            childSObject: "Zulu__c",
            field: "Parent__c",
            relationshipName: "Zulu__r",
          },
          {
            childSObject: "Hidden__c",
            field: "Parent__c",
            relationshipName: null,
          },
          {
            childSObject: "Alpha__c",
            field: "Parent__c",
            relationshipName: "Alpha__r",
          },
        ],
      }),
    ]);

    expect(source).toContain(
      'readonly "Alpha__r": SalesforceChildRelationship<\n        "Alpha__c",\n        "Parent__c"',
    );
    expect(source).toContain(
      'readonly "Zulu__r": SalesforceChildRelationship<\n        "Zulu__c",\n        "Parent__c"',
    );
    expect(source).not.toContain("Hidden__c");
    expect(source.indexOf('readonly "Alpha__r"')).toBeLessThan(
      source.indexOf('readonly "Zulu__r"'),
    );
  });

  it("coalesces duplicate child relationship names into exact relationship unions", () => {
    const source = renderSchema([
      objectWith([], {
        childRelationships: [
          {
            childSObject: "FinanceBalanceSnapshot",
            field: "ReferenceEntityId",
            relationshipName: "FinanceBalanceSnapshots",
          },
          {
            childSObject: "FinanceBalanceSnapshot",
            field: "LegalEntityId",
            relationshipName: "FinanceBalanceSnapshots",
          },
          {
            childSObject: "FinanceBalanceSnapshot",
            field: "ReferenceEntityId",
            relationshipName: "FinanceBalanceSnapshots",
          },
        ],
      }),
    ]);

    expect(source).toContain(
      [
        'readonly "FinanceBalanceSnapshots":',
        "        | SalesforceChildRelationship<",
        '            "FinanceBalanceSnapshot",',
        '            "LegalEntityId"',
        "          >",
        "        | SalesforceChildRelationship<",
        '            "FinanceBalanceSnapshot",',
        '            "ReferenceEntityId"',
        "          >;",
      ].join("\n"),
    );
    expect(source.match(/readonly "FinanceBalanceSnapshots"/g)).toHaveLength(1);
    expect(source.match(/"ReferenceEntityId"/g)).toHaveLength(1);
  });

  it("sorts objects and fields without mutating caller-owned arrays", () => {
    const fields = [field({ name: "Zulu__c" }), field({ name: "Alpha__c" })];
    const objects = [
      objectWith(fields, { name: "Zulu__c" }),
      objectWith([], { name: "Alpha__c" }),
    ];

    const source = renderSchema(objects);

    expect(
      source.indexOf('readonly "Alpha__c": SalesforceObject<'),
    ).toBeLessThan(source.indexOf('readonly "Zulu__c": SalesforceObject<'));
    expect(
      source.indexOf('readonly "Alpha__c": SalesforceField<'),
    ).toBeLessThan(source.indexOf('readonly "Zulu__c": SalesforceField<'));
    expect(objects.map((object) => object.name)).toEqual([
      "Zulu__c",
      "Alpha__c",
    ]);
    expect(fields.map((item) => item.name)).toEqual(["Zulu__c", "Alpha__c"]);
  });

  it("renders only the core imports required by the generated schema", () => {
    const scalarOnly = renderSchema([objectWith([field()])]);
    const location = renderSchema([
      objectWith([field({ name: "Office__c", type: "location" })]),
    ]);
    const relationships = renderSchema([
      objectWith(
        [
          field({
            name: "Parent__c",
            type: "reference",
            referenceTo: ["Parent__c"],
            relationshipName: "Parent__r",
          }),
        ],
        {
          childRelationships: [
            {
              childSObject: "Child__c",
              field: "Parent__c",
              relationshipName: "Children__r",
            },
          ],
        },
      ),
    ]);

    expect(scalarOnly).toContain(
      [
        "import type {",
        "  SalesforceField,",
        "  SalesforceObject,",
        '} from "@kysoql/core";',
      ].join("\n"),
    );
    expect(scalarOnly).not.toContain("SalesforceGeolocation,");
    expect(scalarOnly).not.toContain("SalesforceParentRelationship,");
    expect(scalarOnly).not.toContain("SalesforceChildRelationship,");
    expect(location).toContain("  SalesforceGeolocation,");
    expect(relationships).toContain("  SalesforceParentRelationship,");
    expect(relationships).toContain("  SalesforceChildRelationship,");
  });

  it("renders an empty schema deterministically without unused imports", () => {
    expect(renderSchema([])).toBe(
      [
        "// This file is generated by @kysoql/codegen. Do not edit manually.",
        "",
        "export interface SalesforceSchema {",
        "",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("renders empty field, parent, and child blocks and supports a custom schema name", () => {
    const source = renderSchema([objectWith([])], "CustomSchema");

    expect(source).toContain("export interface CustomSchema {");
    expect(source).toContain(
      'readonly "Fixture__c": SalesforceObject<\n    Record<string, never>,\n    Record<string, never>,\n    Record<string, never>,\n    never,\n    Record<string, never>,\n    boolean,\n    "none"\n  >;',
    );
    expect(source.endsWith("\n")).toBe(true);
  });
});
