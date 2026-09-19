import { describe, expect, it } from "vitest";

import {
  parseSalesforceObjectDescription,
  parseSchemaName,
} from "#/validation";

describe("codegen validation", () => {
  it.each(["Schema", "_Schema", "$Schema", "Schema9"])(
    "accepts a valid TypeScript schema identifier: %s",
    (schemaName) => {
      expect(parseSchemaName(schemaName)).toBe(schemaName);
    },
  );

  it.each(["not-valid", "9Invalid", "with space", "Salesforce.Schema", ""])(
    "rejects an invalid TypeScript schema identifier: %j",
    (schemaName) => {
      expect(() => parseSchemaName(schemaName)).toThrow(
        `Invalid schema name: ${schemaName}`,
      );
    },
  );

  it("preserves Salesforce polymorphic reference metadata", () => {
    expect(
      parseSalesforceObjectDescription(
        {
          name: "Event",
          fields: [
            {
              name: "WhatId",
              type: "reference",
              nillable: true,
              filterable: true,
              sortable: true,
              groupable: false,
              aggregatable: false,
              custom: false,
              referenceTo: ["Account", "Opportunity"],
              relationshipName: "What",
              namePointing: true,
              polymorphicForeignKey: true,
            },
          ],
        },
        "Event",
      ),
    ).toEqual({
      name: "Event",
      fields: [
        {
          name: "WhatId",
          type: "reference",
          nillable: true,
          filterable: true,
          sortable: true,
          groupable: false,
          aggregatable: false,
          custom: false,
          referenceTo: ["Account", "Opportunity"],
          relationshipName: "What",
          namePointing: true,
          polymorphicForeignKey: true,
        },
      ],
    });
  });

  it("preserves Salesforce supported scope names", () => {
    expect(
      parseSalesforceObjectDescription(
        {
          name: "Account",
          fields: [],
          supportedScopes: [
            { name: "mine", label: "My accounts" },
            { name: "team", label: "My team's accounts" },
          ],
        },
        "Account",
      ),
    ).toEqual({
      name: "Account",
      fields: [],
      supportedScopes: [{ name: "mine" }, { name: "team" }],
    });
  });
});
