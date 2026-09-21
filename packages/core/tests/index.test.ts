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
  type AllRowsNode,
  type AndNode,
  type ApexAccessMode,
  type ApexAccessModeNode,
  type ApexAggregateSelectQueryBuilder,
  type ApexBindExpression,
  type ApexBindNode,
  type ApexCountQueryBuilder,
  type ApexOperandValueExpression,
  type ApexQueryResultNode,
  type ApexSelectQueryBuilder,
  apexBind,
  apexQueryField,
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
  type DataCategoryInput,
  type DataCategorySelectionNode,
  type DataCategorySelector,
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
  type FieldsFunctionNode,
  type FieldsSelector,
  type FilterableLocationFieldReference,
  type FilterableToLabelFieldReference,
  type FormatFunctionBuilder,
  type FormatFunctionNode,
  type FormattableFieldReference,
  type ForUpdateNode,
  type ForViewReferenceMode,
  type ForViewReferenceNode,
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
  type KnowledgeUpdateMode,
  type KnowledgeUpdateNode,
  Kysoql,
  type LikeComparisonOperator,
  type LimitNode,
  type LocationFieldReference,
  type MultiSelectComparisonOperator,
  type NotNode,
  type NumericAggregatableFieldReference,
  type OffsetNode,
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
  type SalesforceObjectDataCategory,
  type SalesforceObjectDataCategoryGroup,
  type SalesforceObjectMruEnabled,
  type SalesforceObjectSupportedScope,
  type SalesforceParentRelationship,
  type SalesforceQueryResult,
  type SalesforceRecordAttributes,
  type SalesforceRow,
  type SalesforceSchema,
  type SelectExpressionBuilder,
  type SelectedSemiJoinSubqueryBuilder,
  type SelectFunctionModule,
  type SelectionNode,
  type SelectQueryBuilder,
  type SelectQueryBuilderProps,
  type SelectQueryMode,
  type SelectQueryNode,
  type SemiJoinQueryCreator,
  type SemiJoinSubqueryBuilder,
  type SemiJoinSubqueryExpression,
  type SemiJoinSubqueryFactory,
  type SemiJoinSubqueryNode,
  type SetComparisonOperator,
  type SObjectNode,
  type SoqlCurrencyLiteral,
  type SoqlDateLiteral,
  type SoqlDateTimeLiteral,
  type SoqlRelativeDateFamily,
  type SoqlRelativeDateLiteral,
  type SoqlRelativeDateValue,
  type SoqlTemporalLiteral,
  type SoqlTimeLiteral,
  soqlCurrency,
  soqlDate,
  soqlDateTime,
  soqlRelativeDate,
  soqlTime,
  type ToLabelFunctionBuilder,
  type ToLabelFilterComparisonOperator,
  type ToLabelFilterFunctionExpression,
  type ToLabelFunctionNode,
  type TranslatableFieldReference,
  type TypeOfBuilder,
  type TypeOfElseBuilder,
  type TypeOfElseFieldList,
  type TypeOfFieldList,
  type TypeOfNode,
  type TypeOfWhenBuilder,
  type TypeOfWhenNode,
  type UserProfileFeedWithNode,
  type UsingScopeNode,
  type ValueListNode,
  type ValueNode,
  type WhereExpressionFactory,
  type WhereNode,
  type WithDataCategoryNode,
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
    Record<string, never>
  >;
  apexAccessMode: ApexAccessMode;
  apexAccessModeNode: ApexAccessModeNode;
  apexAggregateSelectQueryBuilder: ApexAggregateSelectQueryBuilder<
    Record<string, never>,
    never,
    Record<string, never>
  >;
  apexBindExpression: ApexBindExpression<string>;
  apexBindNode: ApexBindNode;
  apexCountQueryBuilder: ApexCountQueryBuilder<Record<string, never>, never>;
  apexQueryResultNode: ApexQueryResultNode;
  apexOperandValueExpression: ApexOperandValueExpression<
    Record<string, never>,
    never,
    "Id",
    "="
  >;
  apexSelectQueryBuilder: ApexSelectQueryBuilder<
    Record<string, never>,
    never,
    Record<string, never>
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
  allRowsNode: AllRowsNode;
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
  dataCategoryInput: DataCategoryInput<"All" | "usa__c">;
  dataCategorySelectionNode: DataCategorySelectionNode;
  dataCategorySelector: DataCategorySelector;
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
  forUpdateNode: ForUpdateNode;
  forViewReferenceMode: ForViewReferenceMode;
  forViewReferenceNode: ForViewReferenceNode;
  knowledgeUpdateMode: KnowledgeUpdateMode;
  knowledgeUpdateNode: KnowledgeUpdateNode;
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
  offsetNode: OffsetNode;
  operationNode: OperationNode;
  orNode: OrNode;
  operatorNode: OperatorNode;
  orderByDirection: OrderByDirection;
  orderByItemNode: OrderByItemNode;
  orderByNulls: OrderByNulls;
  orderByNode: OrderByNode;
  orderedComparisonOperator: OrderedComparisonOperator;
  setComparisonOperator: SetComparisonOperator;
  soqlCurrencyLiteral: SoqlCurrencyLiteral;
  queryCompiler: QueryCompiler;
  queryCreatorConfig: QueryCreatorConfig;
  queryExecutor: QueryExecutor;
  referenceNode: ReferenceNode;
  relationshipSubqueryBuilder: RelationshipSubqueryBuilder<
    Record<string, never>,
    never,
    Record<string, never>
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
  salesforceObjectDataCategory: SalesforceObjectDataCategory<
    SalesforceObject<
      Record<string, never>,
      Record<string, never>,
      Record<string, never>,
      never,
      { readonly Geography__c: "All" | "usa__c" }
    >,
    "Geography__c"
  >;
  salesforceObjectMruEnabled: SalesforceObjectMruEnabled<unknown>;
  salesforceObjectDataCategoryGroup: SalesforceObjectDataCategoryGroup<
    SalesforceObject<
      Record<string, never>,
      Record<string, never>,
      Record<string, never>,
      never,
      { readonly Geography__c: "All" }
    >
  >;
  salesforceObjectSupportedScope: SalesforceObjectSupportedScope<
    SalesforceObject<
      {
        readonly Id: SalesforceField<string, "id", false, true, true, true>;
      },
      Record<string, never>,
      Record<string, never>,
      "mine" | "team"
    >
  >;
  salesforceParentRelationship: SalesforceParentRelationship<
    "Parent",
    "ParentId",
    true
  >;
  salesforceQueryResult: SalesforceQueryResult<{ readonly Id: string }>;
  salesforceRecordAttributes: SalesforceRecordAttributes<"Account">;
  salesforceRow: SalesforceRow<
    SalesforceObject<{
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
    }>
  >;
  salesforceSchema: SalesforceSchema;
  selectQueryBuilder: SelectQueryBuilder<
    Record<string, never>,
    never,
    Record<string, never>
  >;
  selectQueryMode: SelectQueryMode;
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
  toLabelFilterComparisonOperator: ToLabelFilterComparisonOperator;
  toLabelFilterFunctionExpression: ToLabelFilterFunctionExpression<"Status">;
  filterableToLabelFieldReference: FilterableToLabelFieldReference<
    Record<string, never>,
    never,
    "Status"
  >;
  toLabelFunctionNode: ToLabelFunctionNode;
  translatableFieldReference: TranslatableFieldReference<
    Record<string, never>,
    never,
    "Status"
  >;
  typeOfBuilder: TypeOfBuilder<Record<string, never>, "Account">;
  typeOfElseBuilder: TypeOfElseBuilder<
    Record<string, never>,
    "Account",
    "Account",
    Record<string, never>
  >;
  typeOfElseFieldList: TypeOfElseFieldList<Record<string, never>, never, "Id">;
  typeOfFieldList: TypeOfFieldList<Record<string, never>, never, "Id">;
  typeOfNode: TypeOfNode;
  typeOfWhenBuilder: TypeOfWhenBuilder<
    Record<string, never>,
    "Account",
    "Account",
    Record<string, never>
  >;
  typeOfWhenNode: TypeOfWhenNode;
  usingScopeNode: UsingScopeNode;
  userProfileFeedWithNode: UserProfileFeedWithNode;
  valueListNode: ValueListNode;
  valueNode: ValueNode;
  whereExpressionFactory: WhereExpressionFactory<Record<string, never>, never>;
  whereNode: WhereNode;
  withDataCategoryNode: WithDataCategoryNode;
};

describe("@kysoql/core public API", () => {
  it("exports every runtime entrypoint through the package barrel", () => {
    expect(Kysoql).toBeTypeOf("function");
    expect(QueryCreator).toBeTypeOf("function");
    expect(DefaultQueryCompiler).toBeTypeOf("function");
    expect(apexBind).toBeTypeOf("function");
    expect(apexQueryField).toBeTypeOf("function");
    expect(soqlCurrency).toBeTypeOf("function");
    expect(soqlDate).toBeTypeOf("function");
    expect(soqlDateTime).toBeTypeOf("function");
    expect(soqlRelativeDate).toBeTypeOf("function");
    expect(soqlTime).toBeTypeOf("function");
  });

  it("exports the complete public type surface through the package barrel", () => {
    expectTypeOf<PublicTypeSurface>().toMatchTypeOf<PublicTypeSurface>();
  });
});
