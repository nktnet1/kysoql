import { describe, expect, it } from "vitest";

import { renderSchema } from "../src/render.js";
import type {
  SalesforceFieldDescription,
  SalesforceObjectDescription,
} from "../src/types.js";

const field = (
  overrides: Partial<SalesforceFieldDescription> = {},
): SalesforceFieldDescription => ({
  name: "Field__c",
  type: "string",
  nillable: false,
  filterable: true,
  sortable: true,
  groupable: true,
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
    ["location", "unknown"],
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
        "        never",
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
      '        "multipicklist",\n        false,\n        true,\n        true,\n        true,\n        never,\n        never,\n        never',
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
      '        "string",\n        false,\n        true,\n        true,\n        true,\n        never,\n        never,\n        never',
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
      '        "Account" | "User",\n        "Owner__r",\n        never',
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
      '        "reference",\n        false,\n        true,\n        true,\n        true,\n        never,\n        "EmptyReference__r",\n        never',
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

  it("sorts objects and fields without mutating caller-owned arrays", () => {
    const fields = [field({ name: "Zulu__c" }), field({ name: "Alpha__c" })];
    const objects = [
      objectWith(fields, { name: "Zulu__c" }),
      objectWith([], { name: "Alpha__c" }),
    ];

    const source = renderSchema(objects);

    expect(source.indexOf('readonly "Alpha__c": SalesforceObject<')).toBeLessThan(
      source.indexOf('readonly "Zulu__c": SalesforceObject<'),
    );
    expect(source.indexOf('readonly "Alpha__c": SalesforceField<')).toBeLessThan(
      source.indexOf('readonly "Zulu__c": SalesforceField<'),
    );
    expect(objects.map((object) => object.name)).toEqual(["Zulu__c", "Alpha__c"]);
    expect(fields.map((item) => item.name)).toEqual(["Zulu__c", "Alpha__c"]);
  });

  it("renders an empty schema deterministically", () => {
    expect(renderSchema([])).toBe(
      [
        "// This file is generated by @kysoql/codegen. Do not edit manually.",
        "",
        "import type {",
        "  SalesforceChildRelationship,",
        "  SalesforceField,",
        "  SalesforceObject,",
        "  SalesforceParentRelationship,",
        '} from "@kysoql/core";',
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
      'readonly "Fixture__c": SalesforceObject<\n    {},\n    {},\n    {}\n  >;',
    );
    expect(source.endsWith("\n")).toBe(true);
  });
});
