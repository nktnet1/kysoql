import { describe, expect, expectTypeOf, it } from "vitest";

import {
  DefaultQueryCompiler,
  Kysoql,
  QueryCreator,
  kysoql,
  soqlDate,
  soqlDateTime,
  soqlRelativeDate,
  soqlTime,
  type AndNode,
  type BinaryOperationNode,
  type ComparisonOperator,
  type CompiledQuery,
  type EqualityComparisonOperator,
  type ExpressionBuilder,
  type ExpressionWrapper,
  type LikeComparisonOperator,
  type LimitNode,
  type MultiSelectComparisonOperator,
  type NotNode,
  type OperationNode,
  type OrNode,
  type OperatorNode,
  type OrderByDirection,
  type OrderByItemNode,
  type OrderByNulls,
  type OrderByNode,
  type OrderedComparisonOperator,
  type SetComparisonOperator,
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
  type SoqlRelativeDateLiteral,
  type SoqlRelativeDateValue,
  type SoqlTemporalLiteral,
  type SoqlTimeLiteral,
  type ValueListNode,
  type ValueNode,
  type WhereExpressionFactory,
  type WhereNode,
} from "#/index";

type PublicTypeSurface = {
  andNode: AndNode;
  binaryOperationNode: BinaryOperationNode;
  comparisonOperator: ComparisonOperator;
  compiledQuery: CompiledQuery;
  equalityComparisonOperator: EqualityComparisonOperator;
  expressionBuilder: ExpressionBuilder<Record<string, never>, never>;
  expressionWrapper: ExpressionWrapper<Record<string, never>, never>;
  likeComparisonOperator: LikeComparisonOperator;
  limitNode: LimitNode;
  multiSelectComparisonOperator: MultiSelectComparisonOperator;
  notNode: NotNode;
  operationNode: OperationNode;
  orNode: OrNode;
  operatorNode: OperatorNode;
  orderByDirection: OrderByDirection;
  orderByItemNode: OrderByItemNode;
  orderByNulls: OrderByNulls;
  orderByNode: OrderByNode;
  orderedComparisonOperator: OrderedComparisonOperator;
  setComparisonOperator: SetComparisonOperator;
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
  soqlRelativeDateLiteral: SoqlRelativeDateLiteral;
  soqlRelativeDateValue: SoqlRelativeDateValue;
  soqlTemporalLiteral: SoqlTemporalLiteral;
  soqlTimeLiteral: SoqlTimeLiteral;
  valueListNode: ValueListNode;
  valueNode: ValueNode;
  whereExpressionFactory: WhereExpressionFactory<Record<string, never>, never>;
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
    expect(soqlRelativeDate).toBeTypeOf("function");
    expect(soqlTime).toBeTypeOf("function");
  });

  it(
    "exports the complete public type surface through the package barrel",
    () => {
      expectTypeOf<PublicTypeSurface>().toMatchTypeOf<PublicTypeSurface>();
    },
  );
});
