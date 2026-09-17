import { expectTypeOf, it } from "vitest";

import { renderSchema } from "../src/index.js";
import type {
  SalesforceChildRelationshipDescription,
  SalesforceDescribeClient,
  SalesforceFieldDescription,
  SalesforceGlobalDescription,
  SalesforceGlobalObjectDescription,
  SalesforceObjectDescription,
  SalesforcePicklistValue,
} from "../src/index.js";

it("exports the complete codegen public API from the package entrypoint", () => {
  expectTypeOf(renderSchema).toBeFunction();

  expectTypeOf<SalesforcePicklistValue>().toMatchTypeOf<{
    readonly active?: boolean;
    readonly value: string;
  }>();
  expectTypeOf<SalesforceFieldDescription>().toMatchTypeOf<{
    readonly name: string;
    readonly type: string;
  }>();
  expectTypeOf<SalesforceChildRelationshipDescription>().toMatchTypeOf<{
    readonly childSObject: string;
    readonly field: string;
  }>();
  expectTypeOf<SalesforceGlobalObjectDescription>().toMatchTypeOf<{
    readonly name: string;
    readonly queryable: boolean;
  }>();
  expectTypeOf<SalesforceGlobalDescription>().toMatchTypeOf<{
    readonly sobjects: readonly SalesforceGlobalObjectDescription[];
  }>();
  expectTypeOf<SalesforceObjectDescription>().toMatchTypeOf<{
    readonly name: string;
    readonly fields: readonly SalesforceFieldDescription[];
  }>();
  expectTypeOf<SalesforceDescribeClient>().toMatchTypeOf<{
    describeGlobal(): Promise<SalesforceGlobalDescription>;
    describe(objectName: string): Promise<SalesforceObjectDescription>;
  }>();
});
