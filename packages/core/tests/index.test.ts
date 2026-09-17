import { describe, expect, expectTypeOf, it } from "vitest";

import {
  DefaultQueryCompiler,
  Kysoql,
  QueryCreator,
  kysoql,
  soqlDate,
  soqlDateTime,
  soqlTime,
  type AndNode,
  type BinaryOperationNode,
  type ComparisonOperator,
  type CompiledQuery,
  type EqualityComparisonOperator,
  type LikeComparisonOperator,
  type OperationNode,
  type OperatorNode,
  type OrderByDirection,
  type OrderByItemNode,
  type OrderByNode,
  type OrderedComparisonOperator,
  type QueryCompiler,
  type QueryCreatorConfig,
  type QueryExecutor,
  type ReferenceNode,
  type SalesforceChildRelationship,
  type SalesforceField,
  type SalesforceFieldFilterValue,
  type SalesforceFieldValue,
  type SalesforceObject,
  type SalesforceParentRelationship,
  type SalesforceRow,
  type SalesforceSchema,
  type SelectQueryBuilder,
  type SelectQueryBuilderProps,
  type SelectQueryNode,
  type SelectionNode,
  type SObjectNode,
  type SoqlDateLiteral,
  type SoqlDateTimeLiteral,
  type SoqlTemporalLiteral,
  type SoqlTimeLiteral,
  type ValueNode,
  type WhereNode,
} from "../src/index.js";

type PublicTypeSurface = {
  andNode: AndNode;
  binaryOperationNode: BinaryOperationNode;
  comparisonOperator: ComparisonOperator;
  compiledQuery: CompiledQuery;
  equalityComparisonOperator: EqualityComparisonOperator;
  likeComparisonOperator: LikeComparisonOperator;
  operationNode: OperationNode;
  operatorNode: OperatorNode;
  orderByDirection: OrderByDirection;
  orderByItemNode: OrderByItemNode;
  orderByNode: OrderByNode;
  orderedComparisonOperator: OrderedComparisonOperator;
  queryCompiler: QueryCompiler;
  queryCreatorConfig: QueryCreatorConfig;
  queryExecutor: QueryExecutor;
  referenceNode: ReferenceNode;
  salesforceChildRelationship: SalesforceChildRelationship<"Child", "Parent">;
  salesforceField: SalesforceField<string, "string", false, true, true, true>;
  salesforceFieldFilterValue: SalesforceFieldFilterValue<
    SalesforceField<string, "string", false, true, true, true>
  >;
  salesforceFieldValue: SalesforceFieldValue<
    SalesforceField<string, "string", false, true, true, true>
  >;
  salesforceObject: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
  }>;
  salesforceParentRelationship: SalesforceParentRelationship<
    "Parent",
    "ParentId",
    true
  >;
  salesforceRow: SalesforceRow<
    SalesforceObject<{
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
    }>
  >;
  salesforceSchema: SalesforceSchema;
  selectQueryBuilder: SelectQueryBuilder<
    Record<string, never>,
    never,
    Record<never, never>
  >;
  selectQueryBuilderProps: SelectQueryBuilderProps;
  selectQueryNode: SelectQueryNode;
  selectionNode: SelectionNode;
  sobjectNode: SObjectNode;
  soqlDateLiteral: SoqlDateLiteral;
  soqlDateTimeLiteral: SoqlDateTimeLiteral;
  soqlTemporalLiteral: SoqlTemporalLiteral;
  soqlTimeLiteral: SoqlTimeLiteral;
  valueNode: ValueNode;
  whereNode: WhereNode;
};

describe("@kysoql/core public API", () => {
  it("exposes the package version", () => {
    expect(kysoql()).toEqual({ version: "0.0.0" });
  });

  it("exports every runtime entrypoint through the package barrel", () => {
    expect(Kysoql).toBeTypeOf("function");
    expect(QueryCreator).toBeTypeOf("function");
    expect(DefaultQueryCompiler).toBeTypeOf("function");
    expect(soqlDate).toBeTypeOf("function");
    expect(soqlDateTime).toBeTypeOf("function");
    expect(soqlTime).toBeTypeOf("function");
  });

  it(
    "exports the complete public type surface through the package barrel",
    () => {
      expectTypeOf<PublicTypeSurface>().toMatchTypeOf<PublicTypeSurface>();
    },
  );
});
