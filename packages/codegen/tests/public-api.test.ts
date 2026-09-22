import { expectTypeOf, it } from "vitest";
import type {
  GenerateSchemaOptions,
  KysoqlConfig,
  ObjectFieldFilter,
  ObjectFieldFilters,
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
import {
  defineConfig,
  generateSchema,
  loadSchema,
  renderSchema,
} from "#/index";

it("exports the complete codegen public API from the package entrypoint", () => {
  expectTypeOf(defineConfig).toBeFunction();
  expectTypeOf(
    defineConfig({ objects: ["Account"] }),
  ).toEqualTypeOf<KysoqlConfig>();
  expectTypeOf<KysoqlConfig>().toEqualTypeOf<{
    readonly objects?: readonly string[];
    readonly fields?: ObjectFieldFilters;
    readonly output?: string;
    readonly schemaName?: string;
  }>();
  expectTypeOf(generateSchema).toBeFunction();
  expectTypeOf(loadSchema).toBeFunction();
  expectTypeOf(renderSchema).toBeFunction();

  expectTypeOf<GenerateSchemaOptions>().toMatchTypeOf<{
    readonly client: SalesforceDescribeClient;
    readonly output: string;
    readonly objects?: readonly string[];
    readonly fields?: ObjectFieldFilters;
    readonly schemaName?: string;
  }>();

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
    readonly mruEnabled?: boolean;
    readonly childRelationships?: readonly SalesforceChildRelationshipDescription[];
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


it("exports field rules for both configuration and programmatic generation", () => {
  expectTypeOf<ObjectFieldFilter>().toMatchTypeOf<
    { readonly include: readonly string[] } | { readonly exclude: readonly string[] }
  >();
  expectTypeOf<GenerateSchemaOptions["fields"]>().toEqualTypeOf<ObjectFieldFilters | undefined>();
});
