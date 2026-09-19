import { expectTypeOf, it } from "vitest";
import type {
  SalesforceChildRelationshipDescription,
  SalesforceDataCategoryGroupDescription,
  SalesforceDataCategoryGroupResponse,
  SalesforceDataCategoryGroupsResponse,
  SalesforceDataCategorySummaryResponse,
  SalesforceDescribeClient,
  SalesforceFieldDescription,
  SalesforceGlobalDescription,
  SalesforceGlobalObjectDescription,
  SalesforceObjectDescription,
  SalesforcePicklistValue,
  SalesforceSupportedScopeDescription,
} from "#/index";
import { renderSchema } from "#/index";

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
    readonly supportedScopes?: readonly SalesforceSupportedScopeDescription[];
    readonly dataCategoryGroups?: readonly SalesforceDataCategoryGroupDescription[];
  }>();
  expectTypeOf<SalesforceSupportedScopeDescription>().toEqualTypeOf<{
    readonly name: string;
  }>();
  expectTypeOf<SalesforceDataCategorySummaryResponse>().toMatchTypeOf<{
    readonly name: string;
  }>();
  expectTypeOf<SalesforceDataCategoryGroupResponse>().toMatchTypeOf<{
    readonly name: string;
    readonly topCategories: readonly SalesforceDataCategorySummaryResponse[];
  }>();
  expectTypeOf<SalesforceDataCategoryGroupsResponse>().toEqualTypeOf<{
    readonly categoryGroups: readonly SalesforceDataCategoryGroupResponse[];
  }>();
  expectTypeOf<SalesforceDataCategoryGroupDescription>().toEqualTypeOf<{
    readonly name: string;
    readonly categories: readonly string[];
  }>();
  expectTypeOf<SalesforceDescribeClient>().toMatchTypeOf<{
    describeGlobal(): Promise<SalesforceGlobalDescription>;
    describe(objectName: string): Promise<SalesforceObjectDescription>;
    describeDataCategoryGroups?(
      objectName: string,
    ): Promise<SalesforceDataCategoryGroupsResponse | undefined>;
  }>();
});
