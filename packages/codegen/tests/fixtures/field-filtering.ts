import type { ObjectFieldFilters } from "#src/config";
import type {
  SalesforceFieldDescription,
  SalesforceObjectDescription,
} from "#src/types";

export const field = (
  name: string,
  overrides: Partial<SalesforceFieldDescription> = {},
): SalesforceFieldDescription => ({
  name,
  type: name === "Id" ? "id" : "string",
  nillable: false,
  filterable: true,
  sortable: true,
  groupable: true,
  aggregatable: true,
  custom: name.endsWith("__c"),
  ...overrides,
});

export const fixtureObjects: readonly SalesforceObjectDescription[] = [
  {
    name: "Account",
    fields: [
      field("Id"),
      field("Name"),
      field("Industry"),
      field("Secret__c"),
      field("OwnerId", {
        type: "reference",
        referenceTo: ["User"],
        relationshipName: "Owner",
      }),
    ],
    childRelationships: [
      {
        childSObject: "Contact",
        field: "AccountId",
        relationshipName: "Contacts",
      },
      {
        childSObject: "Missing__c",
        field: "Account__c",
        relationshipName: "Missing__r",
      },
    ],
    mruEnabled: true,
    supportedScopes: [{ name: "mine" }],
  },
  {
    name: "Contact",
    fields: [
      field("Id"),
      field("LastName"),
      field("Email"),
      field("Secret__c"),
      field("AccountId", {
        type: "reference",
        nillable: true,
        referenceTo: ["Account"],
        relationshipName: "Account",
      }),
    ],
    childRelationships: [
      { childSObject: "Task", field: "WhoId", relationshipName: "Tasks" },
    ],
  },
  {
    name: "Task",
    fields: [
      field("Id"),
      field("Subject"),
      field("WhoId", {
        type: "reference",
        nillable: true,
        referenceTo: ["Contact", "Lead"],
        relationshipName: "Who",
        namePointing: true,
        polymorphicForeignKey: true,
      }),
    ],
  },
  { name: "User", fields: [field("Id"), field("Name")] },
];

export const fixtureFilters: ObjectFieldFilters = {
  Account: { include: ["Id", "Name", "OwnerId"] },
  Contact: { exclude: ["Email", "Secret__c"] },
  Task: { include: ["Id", "WhoId"] },
};
