import { describe, expect, it } from "vitest";

import {
  parseSalesforceDataCategoryGroupsResponse,
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

  it("parses recursive Salesforce data-category groups into sorted generated names", () => {
    expect(
      parseSalesforceDataCategoryGroupsResponse(
        {
          categoryGroups: [
            {
              name: "Geography__c",
              label: "Geography",
              topCategories: [
                {
                  name: "All",
                  label: "All",
                  childCategories: [
                    {
                      name: "usa__c",
                      childCategories: null,
                    },
                    {
                      name: "europe__c",
                      childCategories: [
                        { name: "france__c" },
                        { name: "uk__c", childCategories: [] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        "KnowledgeArticleVersion",
      ),
    ).toEqual([
      {
        name: "Geography__c",
        categories: ["All", "europe__c", "france__c", "uk__c", "usa__c"],
      },
    ]);
  });

  it("rejects malformed nested Salesforce data-category responses with object context", () => {
    expect(() =>
      parseSalesforceDataCategoryGroupsResponse(
        {
          categoryGroups: [
            {
              name: "Geography__c",
              topCategories: [
                { name: "All", childCategories: [{ name: 42 }] },
              ],
            },
          ],
        },
        "KnowledgeArticleVersion",
      ),
    ).toThrow(
      /Invalid Salesforce data category response for KnowledgeArticleVersion/,
    );
  });

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

  it("preserves Salesforce MRU capability metadata", () => {
    expect(
      parseSalesforceObjectDescription(
        {
          name: "Account",
          fields: [],
          mruEnabled: true,
        },
        "Account",
      ),
    ).toEqual({
      name: "Account",
      fields: [],
      mruEnabled: true,
    });

    expect(
      parseSalesforceObjectDescription(
        {
          name: "AsyncApexJob",
          fields: [],
          mruEnabled: false,
        },
        "AsyncApexJob",
      ),
    ).toEqual({
      name: "AsyncApexJob",
      fields: [],
      mruEnabled: false,
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
