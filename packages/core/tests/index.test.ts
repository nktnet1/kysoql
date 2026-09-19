import { describe, expect, expectTypeOf, it } from "vitest";

import {
  type AdvancedGroupByMode,
  type AggregatableFieldReference,
  type AggregateFormatFunctionBuilder,
  type AggregateFunction,
  type AggregateFunctionBuilder,
  type AggregateFunctionExpression,
  type AggregateFunctionModule,
  type AggregateFunctionNode,
  type AggregateSelectQueryBuilder,
  type AliasedAggregateFunctionBuilder,
  type AliasedDateFunctionBuilder,
  type AliasedDistanceFunctionBuilder,
  type AliasedSelectFunctionBuilder,
  type AliasNode,
  type AndNode,
  type BinaryOperationNode,
  type ComparisonOperator,
  type CompiledQuery,
  type ConvertCurrencyFunctionBuilder,
  type ConvertCurrencyFunctionNode,
  type ConvertTimezoneFunctionBuilder,
  type ConvertTimezoneFunctionNode,
  type ConvertTimezoneIdentity,
  type CountAllFunctionBuilder,
  type CountQueryBuilder,
  type CurrencyFieldReference,
  type DateFunction,
  type DateFunctionArgumentNode,
  type DateFunctionBuilder,
  type DateFunctionExpression,
  type DateFunctionIdentity,
  type DateFunctionNode,
  type DateGroupableFieldReference,
  DefaultQueryCompiler,
  type DistanceComparisonOperator,
  type DistanceDestinationNode,
  type DistanceFunctionBuilder,
  type DistanceFunctionExpression,
  type DistanceFunctionNode,
  type DistanceUnit,
  type EqualityComparisonOperator,
  type ExpressionBuilder,
  type ExpressionWrapper,
  type FilterableLocationFieldReference,
  type FieldsFunctionNode,
  type FieldsSelector,
  type FormatFunctionBuilder,
  type FormatFunctionNode,
  type FormattableFieldReference,
  type GeolocationExpressionBuilder,
  type GeolocationFilterExpressionBuilder,
  type GeolocationFilterFunctionModule,
  type GeolocationFunctionBuilder,
  type GeolocationFunctionModule,
  type GeolocationFunctionNode,
  type GroupByNode,
  type GroupedHavingFieldName,
  type GroupingFunctionBuilder,
  type HavingExpressionBuilder,
  type HavingExpressionFactory,
  type HavingExpressionWrapper,
  type HavingNode,
  Kysoql,
  kysoql,
  type LikeComparisonOperator,
  type LimitNode,
  type LocationFieldReference,
  type MultiSelectComparisonOperator,
  type NotNode,
  type NumericAggregatableFieldReference,
  type OperationNode,
  type OperatorNode,
  type OrderByDirection,
  type OrderByItemNode,
  type OrderByNode,
  type OrderByNulls,
  type OrderedComparisonOperator,
  type OrNode,
  type QueryCompiler,
  QueryCreator,
  type QueryCreatorConfig,
  type QueryExecutor,
  type ReferenceNode,
  type RelationshipSubqueryBuilder,
  type RelationshipSubqueryNode,
  type SalesforceChildRelationship,
  type SalesforceField,
  type SalesforceFieldCustom,
  type SalesforceFieldFilterValue,
  type SalesforceFieldValue,
  type SalesforceGeolocation,
  type SalesforceObject,
  type SalesforceParentRelationship,
  type SalesforceQueryResult,
  type SalesforceRow,
  type SalesforceSchema,
  type SelectExpressionBuilder,
  type SelectedSemiJoinSubqueryBuilder,
  type SelectFunctionModule,
  type SelectionNode,
  type SelectQueryBuilder,
  type SelectQueryBuilderProps,
  type SelectQueryNode,
  type SemiJoinQueryCreator,
  type SemiJoinSubqueryBuilder,
  type SemiJoinSubqueryExpression,
  type SemiJoinSubqueryFactory,
  type SemiJoinSubqueryNode,
  type SetComparisonOperator,
  type SObjectNode,
  type SoqlDateLiteral,
  type SoqlDateTimeLiteral,
  type SoqlRelativeDateFamily,
  type SoqlRelativeDateLiteral,
  type SoqlRelativeDateValue,
  type SoqlTemporalLiteral,
  type SoqlTimeLiteral,
  soqlDate,
  soqlDateTime,
  soqlRelativeDate,
  soqlTime,
  type ToLabelFunctionBuilder,
  type ToLabelFunctionNode,
  type TranslatableFieldReference,
  type ValueListNode,
  type ValueNode,
  type WhereExpressionFactory,
  type WhereNode,
} from "#/index";

type PublicTypeSurface = {
  aggregateFormatFunctionBuilder: AggregateFormatFunctionBuilder<string>;
  advancedGroupByMode: AdvancedGroupByMode;
  aggregateFunction: AggregateFunction;
  aggregateFunctionBuilder: AggregateFunctionBuilder<number>;
  aggregateFunctionExpression: AggregateFunctionExpression<number>;
  aggregateFunctionModule: AggregateFunctionModule<
    Record<string, never>,
    never
  >;
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
  aliasedDateFunctionBuilder: AliasedDateFunctionBuilder<
    number,
    "year",
    "calendarYear(CreatedDate)"
  >;
  aliasedDistanceFunctionBuilder: AliasedDistanceFunctionBuilder<
    number,
    "distance"
  >;
  aliasedSelectFunctionBuilder: AliasedSelectFunctionBuilder<string, "label">;
  aliasNode: AliasNode;
  andNode: AndNode;
  binaryOperationNode: BinaryOperationNode;
  comparisonOperator: ComparisonOperator;
  compiledQuery: CompiledQuery;
  convertCurrencyFunctionBuilder: ConvertCurrencyFunctionBuilder<number>;
  convertCurrencyFunctionNode: ConvertCurrencyFunctionNode;
  convertTimezoneFunctionBuilder: ConvertTimezoneFunctionBuilder<"CreatedDate">;
  convertTimezoneFunctionNode: ConvertTimezoneFunctionNode;
  convertTimezoneIdentity: ConvertTimezoneIdentity<"CreatedDate">;
  countAllFunctionBuilder: CountAllFunctionBuilder;
  currencyFieldReference: CurrencyFieldReference<
    Record<string, never>,
    never,
    "Amount"
  >;
  countQueryBuilder: CountQueryBuilder<Record<string, never>, never>;
  dateFunction: DateFunction;
  dateFunctionArgumentNode: DateFunctionArgumentNode;
  dateFunctionBuilder: DateFunctionBuilder<
    number,
    number,
    EqualityComparisonOperator,
    "calendarYear(CreatedDate)"
  >;
  dateFunctionExpression: DateFunctionExpression<
    number,
    number,
    EqualityComparisonOperator,
    "calendarYear(CreatedDate)"
  >;
  dateFunctionIdentity: DateFunctionIdentity<"calendarYear", "CreatedDate">;
  dateFunctionNode: DateFunctionNode;
  dateGroupableFieldReference: DateGroupableFieldReference<
    Record<string, never>,
    never,
    "CreatedDate"
  >;
  distanceComparisonOperator: DistanceComparisonOperator;
  distanceDestinationNode: DistanceDestinationNode;
  distanceFunctionBuilder: DistanceFunctionBuilder<number, true, true>;
  distanceFunctionExpression: DistanceFunctionExpression<number, true, true>;
  distanceFunctionNode: DistanceFunctionNode;
  distanceUnit: DistanceUnit;
  equalityComparisonOperator: EqualityComparisonOperator;
  expressionBuilder: ExpressionBuilder<Record<string, never>, never>;
  expressionWrapper: ExpressionWrapper<Record<string, never>, never>;
  filterableLocationFieldReference: FilterableLocationFieldReference<
    Record<string, never>,
    never,
    "Location__c"
  >;
  fieldsFunctionNode: FieldsFunctionNode;
  fieldsSelector: FieldsSelector;
  formattableFieldReference: FormattableFieldReference<
    Record<string, never>,
    never,
    "Amount"
  >;
  formatFunctionBuilder: FormatFunctionBuilder<string>;
  formatFunctionNode: FormatFunctionNode;
  geolocationExpressionBuilder: GeolocationExpressionBuilder<
    Record<string, never>,
    never
  >;
  geolocationFilterExpressionBuilder: GeolocationFilterExpressionBuilder<
    Record<string, never>,
    never
  >;
  geolocationFilterFunctionModule: GeolocationFilterFunctionModule<
    Record<string, never>,
    never
  >;
  geolocationFunctionBuilder: GeolocationFunctionBuilder;
  geolocationFunctionModule: GeolocationFunctionModule<
    Record<string, never>,
    never
  >;
  geolocationFunctionNode: GeolocationFunctionNode;
  groupByNode: GroupByNode;
  groupedHavingFieldName: GroupedHavingFieldName<
    Record<string, never>,
    never,
    "Name",
    "Name"
  >;
  groupingFunctionBuilder: GroupingFunctionBuilder;
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
  locationFieldReference: LocationFieldReference<
    Record<string, never>,
    never,
    "Location__c"
  >;
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
  salesforceFieldCustom: SalesforceFieldCustom<
    SalesforceField<
      string,
      "string",
      false,
      true,
      true,
      true,
      never,
      never,
      never,
      false,
      true
    >
  >;
  salesforceFieldFilterValue: SalesforceFieldFilterValue<
    SalesforceField<string, "string", false, true, true, true>
  >;
  salesforceFieldValue: SalesforceFieldValue<
    SalesforceField<string, "string", false, true, true, true>
  >;
  salesforceGeolocation: SalesforceGeolocation;
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
  selectExpressionBuilder: SelectExpressionBuilder<
    Record<string, never>,
    never
  >;
  selectFunctionModule: SelectFunctionModule<Record<string, never>, never>;
  selectionNode: SelectionNode;
  sobjectNode: SObjectNode;
  soqlDateLiteral: SoqlDateLiteral;
  soqlDateTimeLiteral: SoqlDateTimeLiteral;
  soqlRelativeDateFamily: SoqlRelativeDateFamily;
  soqlRelativeDateLiteral: SoqlRelativeDateLiteral;
  soqlRelativeDateValue: SoqlRelativeDateValue;
  soqlTemporalLiteral: SoqlTemporalLiteral;
  soqlTimeLiteral: SoqlTimeLiteral;
  toLabelFunctionBuilder: ToLabelFunctionBuilder<string>;
  toLabelFunctionNode: ToLabelFunctionNode;
  translatableFieldReference: TranslatableFieldReference<
    Record<string, never>,
    never,
    "Status"
  >;
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

  it("exports the complete public type surface through the package barrel", () => {
    expectTypeOf<PublicTypeSurface>().toMatchTypeOf<PublicTypeSurface>();
  });
});
