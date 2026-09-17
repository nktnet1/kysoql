import { expectTypeOf, it } from "vitest";

import type {
  SalesforceField,
  SalesforceObject,
  SalesforceRow,
} from "../src/schema.js";

type FixtureObject = SalesforceObject<{
  readonly Id: SalesforceField<string, "id", false, true, true, true>;
  readonly Amount__c: SalesforceField<number, "double", true, true, true, true>;
}>;

it("derives nullable row values from generated field metadata", () => {
  expectTypeOf<SalesforceRow<FixtureObject>>().toEqualTypeOf<{
    readonly Id: string;
    readonly Amount__c: number | null;
  }>();
});
