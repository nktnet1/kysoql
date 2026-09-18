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
  type AdvancedGroupByMode,
  type AggregateFunction,
  type AggregateFunctionBuilder,
  type AggregateFunctionExpression,
  type AggregateFunctionModule,
  type AggregateFunctionNode,
  type AggregateSelectQueryBuilder,
  type AggregatableFieldReference,
  type AliasedAggregateFunctionBuilder,
  type AliasNode,
  type AndNode,
  type BinaryOperationNode,
  type ComparisonOperator,
  type CompiledQuery,
  type CountAllFunctionBuilder,
  type CountQueryBuilder,
  type EqualityComparisonOperator,
  type ExpressionBuilder,
  type ExpressionWrapper,
  type GroupByNode,
  type GroupedHavingFieldName,
  type HavingExpressionBuilder,
  type HavingExpressionFactory,
  type HavingExpressionWrapper,
  type HavingNode,
  type LikeComparisonOperator,
  type LimitNode,
  type MultiSelectComparisonOperator,
  type NotNode,
  type NumericAggregatableFieldReference,
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
  type RelationshipSubqueryBuilder,
  type RelationshipSubqueryNode,
  type SalesforceChildRelationship,
  type SalesforceField,
  type SalesforceFieldFilterValue,
  type SalesforceFieldValue,
  type SalesforceObject,
  type SalesforceParentRelationship,
  type SalesforceQueryResult,
  type SalesforceRow,
  type SalesforceSchema,
  type SelectQueryBuilder,
  type SelectQueryBuilderProps,
  type SelectQueryNode,
  type SelectedSemiJoinSubqueryBuilder,
  type SemiJoinQueryCreator,
  type SemiJoinSubqueryBuilder,
  type SemiJoinSubqueryExpression,
  type SemiJoinSubqueryFactory,
  type SemiJoinSubqueryNode,
  type SelectExpressionBuilder,
  type SelectionNode,
  type SObjectNode,
  type SoqlDateLiteral,
  type SoqlDateTimeLiteral,
  type SoqlRelativeDateFamily,
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
  advancedGroupByMode: AdvancedGroupByMode;
  aggregateFunction: AggregateFunction;
  aggregateFunctionBuilder: AggregateFunctionBuilder<number>;
  aggregateFunctionExpression: AggregateFunctionExpression<number>;
  aggregateFunctionModule: AggregateFunctionModule<Record<string, never>, never>;
  aggregateFunctionNode: AggregateFunctionNode;
  aggregateSelectQueryBuilder: AggregateSelectQueryBuilder<
    Record<string, never>,
    never,
    Record<never, never>
  >;
  aggregatableFieldReference: AggregatableFieldReference<
    Record<string, never>,
    never,
    "Id"
  >;
  aliasedAggregateFunctionBuilder: AliasedAggregateFunctionBuilder<
    number,
    "count"
  >;
  aliasNode: AliasNode;
  andNode: AndNode;
  binaryOperationNode: BinaryOperationNode;
  comparisonOperator: ComparisonOperator;
  compiledQuery: CompiledQuery;
  countAllFunctionBuilder: CountAllFunctionBuilder;
  countQueryBuilder: CountQueryBuilder<Record<string, never>, never>;
  equalityComparisonOperator: EqualityComparisonOperator;
  expressionBuilder: ExpressionBuilder<Record<string, never>, never>;
  expressionWrapper: ExpressionWrapper<Record<string, never>, never>;
  groupByNode: GroupByNode;
  groupedHavingFieldName: GroupedHavingFieldName<
    Record<string, never>,
    never,
    "Name",
    "Name"
  >;
  havingExpressionBuilder: HavingExpressionBuilder<
    Record<string, never>,
    never,
    "Name"
  >;
  havingExpressionFactory: HavingExpressionFactory<
    Record<string, never>,
    never,
    "Name"
  >;
  havingExpressionWrapper: HavingExpressionWrapper<
    Record<string, never>,
    never,
    "Name"
  >;
  havingNode: HavingNode;
  likeComparisonOperator: LikeComparisonOperator;
  limitNode: LimitNode;
  multiSelectComparisonOperator: MultiSelectComparisonOperator;
  notNode: NotNode;
  numericAggregatableFieldReference: NumericAggregatableFieldReference<
    Record<string, never>,
    never,
    "Amount"
  >;
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
  relationshipSubqueryBuilder: RelationshipSubqueryBuilder<
    Record<string, never>,
    never,
    Record<never, never>
  >;
  relationshipSubqueryNode: RelationshipSubqueryNode;
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
  salesforceQueryResult: SalesforceQueryResult<{ readonly Id: string }>;
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
  selectedSemiJoinSubqueryBuilder: SelectedSemiJoinSubqueryBuilder<
    Record<string, never>,
    never,
    "Id",
    never
  >;
  semiJoinQueryCreator: SemiJoinQueryCreator<
    Record<string, never>,
    never,
    "Id"
  >;
  semiJoinSubqueryBuilder: SemiJoinSubqueryBuilder<
    Record<string, never>,
    never,
    "Id",
    never
  >;
  semiJoinSubqueryExpression: SemiJoinSubqueryExpression<
    Record<string, never>,
    never,
    "Id"
  >;
  semiJoinSubqueryFactory: SemiJoinSubqueryFactory<
    Record<string, never>,
    never,
    "Id"
  >;
  semiJoinSubqueryNode: SemiJoinSubqueryNode;
  selectExpressionBuilder: SelectExpressionBuilder<Record<string, never>, never>;
  selectionNode: SelectionNode;
  sobjectNode: SObjectNode;
  soqlDateLiteral: SoqlDateLiteral;
  soqlDateTimeLiteral: SoqlDateTimeLiteral;
  soqlRelativeDateFamily: SoqlRelativeDateFamily;
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
