import {
  type CountAllFunctionBuilder,
  createSelectExpressionBuilder,
  type SelectExpressionBuilder,
} from "#/expression/aggregate-function-builder";
import {
  createExpressionBuilder,
  type WhereExpressionFactory,
} from "#/expression/expression-builder";
import {
  createGeolocationExpressionBuilder,
  type DistanceFunctionExpression,
  type GeolocationExpressionBuilder,
} from "#/expression/geolocation-function-builder";
import type { FieldsSelector } from "#/operation-node/fields-function-node";
import { ForViewReferenceNode } from "#/operation-node/for-view-reference-node";
import type { ComparisonOperator } from "#/operation-node/operator-node";
import type {
  OrderByDirection,
  OrderByNulls,
} from "#/operation-node/order-by-item-node";
import { QueryNode } from "#/operation-node/query-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import { SelectionNode } from "#/operation-node/selection-node";
import type { TypeOfNode } from "#/operation-node/type-of-node";
import { UsingScopeNode } from "#/operation-node/using-scope-node";
import {
  type AggregateSelection,
  type AggregateSelectionArg,
  parseAggregateSelectArg,
  parseCountSelectArg,
} from "#/parser/aggregate-selection-parser";
import type {
  ComparisonOperatorExpression,
  FilterableFieldName,
  OperandValueExpression,
} from "#/parser/binary-operation-parser";
import {
  type DataCategoryInput,
  type DataCategorySelector,
  parseDataCategorySelection,
} from "#/parser/data-category-parser";
import { validateDateFunctionSelections } from "#/parser/date-function-parser";
import {
  type AvailableSelectExpression,
  type FieldsSelection,
  type FieldsSelectionCheck,
  parseFieldsSelection,
} from "#/parser/fields-selection-parser";
import {
  parseFilterBinaryOperation,
  validateSemiJoinWhere,
} from "#/parser/filter-parser";
import { validateGroupingSelections } from "#/parser/grouping-expression-parser";
import type { KnowledgeArticleUpdateCheck } from "#/parser/knowledge-update-parser";
import { parseLimit } from "#/parser/limit-parser";
import { parseOffset } from "#/parser/offset-parser";
import {
  parseDistanceOrderBy,
  parseOrderBy,
  type SortableFieldName,
} from "#/parser/order-by-parser";
import type {
  ChildObjectName,
  ChildRelationshipName,
  ChildRelationshipReference,
} from "#/parser/reference-parser";
import {
  isSelectFunctionSelectionArg,
  parseSelectFunctionSelectArg,
  type SelectFunctionSelection,
  type SelectFunctionSelectionArg,
  validateUniqueSelectFunctionAliases,
} from "#/parser/select-function-parser";
import {
  parseSelectArg,
  type SelectExpression,
  type Selection,
} from "#/parser/select-parser";
import {
  type AvailableTypeOfReference,
  type PolymorphicRelationshipReference,
  type PolymorphicRelationshipTargets,
  type TypeOfSelection,
  validateTypeOfSelections,
} from "#/parser/type-of-parser";
import {
  parseUserProfileFeedWithUserId,
  type UserProfileFeedWithUserIdCheck,
} from "#/parser/user-profile-feed-parser";
import {
  type AggregateSelectQueryBuilder,
  createAggregateSelectQueryBuilder,
} from "#/query-builder/aggregate-select-query-builder";
import {
  type CountQueryBuilder,
  createCountQueryBuilder,
} from "#/query-builder/count-query-builder";
import {
  createRelationshipSubqueryBuilder,
  type RelationshipSubqueryBuilder,
} from "#/query-builder/relationship-subquery-builder";
import {
  createTypeOfBuilder,
  type TypeOfBuilder,
  type TypeOfBuilderHandled,
  type TypeOfBuilderHasElse,
  type TypeOfBuilderOutput,
} from "#/query-builder/type-of-builder";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import type { QueryExecutor } from "#/query-executor";
import type {
  SalesforceObjectDataCategory,
  SalesforceObjectDataCategoryGroup,
  SalesforceObjectMruEnabled,
  SalesforceObjectSupportedScope,
  SalesforceQueryResult,
} from "#/schema";
import { freeze } from "#/util/object-utils";
import type { Simplify } from "#/util/type-utils";

type ChildObjectForRelationship<
  DB,
  TB extends keyof DB,
  Relationship extends string,
> = ChildObjectName<
  DB,
  TB,
  Extract<Relationship, ChildRelationshipName<DB, TB>>
>;

type UnselectedOnly<O, Value> = [keyof O] extends [never] ? Value : never;

type CountSelectionFactory<DB, TB extends keyof DB> = (
  eb: SelectExpressionBuilder<DB, TB>,
) => CountAllFunctionBuilder;

type AggregateSelectionFactory<
  DB,
  TB extends keyof DB,
  Aggregate extends AggregateSelectionArg,
> = (eb: SelectExpressionBuilder<DB, TB>) => Aggregate;

type SelectFunctionSelectionFactory<
  DB,
  TB extends keyof DB,
  FunctionSelection extends SelectFunctionSelectionArg,
> = (eb: SelectExpressionBuilder<DB, TB>) => FunctionSelection;

type DistanceOrderByFactory<DB, TB extends keyof DB> = (
  eb: GeolocationExpressionBuilder<DB, TB>,
) => DistanceFunctionExpression<unknown, boolean, true>;

export type SelectQueryMode = "plain" | "function" | "typeof";

type AfterSelectFunctionMode<Mode extends SelectQueryMode> =
  Mode extends "plain" ? "function" : Mode;

type AfterTypeOfMode<Mode extends SelectQueryMode> = Mode extends "plain"
  ? "typeof"
  : Mode;

type AfterSubqueryMode<
  Mode extends SelectQueryMode,
  SubqueryFunctionMode extends "none" | "present" | "forbidden",
> = SubqueryFunctionMode extends "present"
  ? AfterSelectFunctionMode<Mode>
  : Mode;

type InitialSubqueryFunctionMode<Mode extends SelectQueryMode> =
  Mode extends "typeof" ? "forbidden" : "none";

type SelectFunctionFactoryForMode<
  Mode extends SelectQueryMode,
  Factory,
> = Mode extends "typeof" ? never : Factory;

type TypeOfModeCheck<Mode extends SelectQueryMode> = Mode extends "function"
  ? readonly [incompatibleQueryMode: never]
  : readonly [];

type CompletedTypeOfBuilder = {
  toOperationNode(): TypeOfNode;
};

type TypeOfValue<Targets extends string, Builder> =
  | TypeOfBuilderOutput<Builder>
  | (TypeOfBuilderHasElse<Builder> extends true
      ? never
      : Exclude<Targets, TypeOfBuilderHandled<Builder>> extends never
        ? never
        : null);

export interface SelectQueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  Mode extends SelectQueryMode = any,
> {
  compile(): CompiledQuery<O>;

  execute(): Promise<readonly O[]>;

  limit(limit: number): SelectQueryBuilder<DB, TB, O, Mode>;

  offset(offset: number): SelectQueryBuilder<DB, TB, O, Mode>;

  forView(
    ..._mruCheck: SalesforceObjectMruEnabled<DB[TB]> extends false
      ? readonly [mruDisabled: never]
      : readonly []
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  forReference(
    ..._mruCheck: SalesforceObjectMruEnabled<DB[TB]> extends false
      ? readonly [mruDisabled: never]
      : readonly []
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  updateTracking(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  updateViewstat(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  usingScope(
    scope: SalesforceObjectSupportedScope<DB[TB]>,
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  withUserId(
    userId: string,
    ..._userProfileFeedCheck: UserProfileFeedWithUserIdCheck<TB>
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  withDataCategory<Group extends SalesforceObjectDataCategoryGroup<DB[TB]>>(
    group: Group,
    selector: DataCategorySelector,
    categories: DataCategoryInput<SalesforceObjectDataCategory<DB[TB], Group>>,
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  orderBy(
    expression: DistanceOrderByFactory<DB, TB>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  orderBy<OE extends string>(
    field: OE & SortableFieldName<DB, TB, OE>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  where(
    expression: WhereExpressionFactory<DB, TB>,
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  select(
    selection: UnselectedOnly<O, CountSelectionFactory<DB, TB>>,
  ): CountQueryBuilder<DB, TB>;

  select<FunctionSelection extends SelectFunctionSelectionArg>(
    selection: SelectFunctionFactoryForMode<
      Mode,
      SelectFunctionSelectionFactory<DB, TB, FunctionSelection>
    >,
  ): SelectQueryBuilder<
    DB,
    TB,
    O & SelectFunctionSelection<FunctionSelection>,
    AfterSelectFunctionMode<Mode>
  >;

  select<Aggregate extends AggregateSelectionArg>(
    selection: UnselectedOnly<O, AggregateSelectionFactory<DB, TB, Aggregate>>,
  ): AggregateSelectQueryBuilder<DB, TB, AggregateSelection<Aggregate>>;

  select<SE extends string>(
    selections: ReadonlyArray<
      SE &
        SelectExpression<DB, TB, SE> &
        AvailableSelectExpression<DB, TB, O, SE>
    >,
  ): SelectQueryBuilder<DB, TB, O & Selection<DB, TB, SE>, Mode>;

  select<SE extends string>(
    selection: SE &
      SelectExpression<DB, TB, SE> &
      AvailableSelectExpression<DB, TB, O, SE>,
  ): SelectQueryBuilder<DB, TB, O & Selection<DB, TB, SE>, Mode>;

  selectFields<Selector extends FieldsSelector>(
    selector: Selector,
    ...check: FieldsSelectionCheck<DB, TB, O, Selector>
  ): SelectQueryBuilder<DB, TB, O & FieldsSelection<DB, TB, Selector>, Mode>;

  selectTypeOf<
    Reference extends string,
    Builder extends CompletedTypeOfBuilder,
  >(
    reference: Reference &
      PolymorphicRelationshipReference<DB, TB, Reference> &
      AvailableTypeOfReference<O, Reference>,
    callback: (
      typeOf: TypeOfBuilder<
        DB,
        PolymorphicRelationshipTargets<DB, TB, Reference>
      >,
    ) => Builder,
    ..._modeCheck: TypeOfModeCheck<Mode>
  ): SelectQueryBuilder<
    DB,
    TB,
    O &
      TypeOfSelection<
        DB,
        TB,
        Reference,
        TypeOfValue<PolymorphicRelationshipTargets<DB, TB, Reference>, Builder>
      >,
    AfterTypeOfMode<Mode>
  >;

  selectSubquery<
    Relationship extends string,
    SubqueryOutput,
    SubqueryFunctionMode extends "none" | "present" | "forbidden",
  >(
    relationship: Relationship &
      ChildRelationshipReference<DB, TB, Relationship>,
    callback: (
      query: RelationshipSubqueryBuilder<
        DB,
        ChildObjectForRelationship<DB, TB, Relationship>,
        Record<never, never>,
        readonly [unknown],
        InitialSubqueryFunctionMode<Mode>
      >,
    ) => RelationshipSubqueryBuilder<
      DB,
      ChildObjectForRelationship<DB, TB, Relationship>,
      SubqueryOutput,
      readonly [unknown],
      SubqueryFunctionMode
    >,
  ): SelectQueryBuilder<
    DB,
    TB,
    O & {
      readonly [Key in Relationship]: SalesforceQueryResult<
        Simplify<SubqueryOutput>
      >;
    },
    AfterSubqueryMode<Mode, SubqueryFunctionMode>
  >;

  toOperationNode(): SelectQueryNode;
}

class SelectQueryBuilderImpl<
  DB,
  TB extends keyof DB,
  O,
  Mode extends SelectQueryMode,
> implements SelectQueryBuilder<DB, TB, O, Mode>
{
  readonly #props: SelectQueryBuilderProps;

  constructor(props: SelectQueryBuilderProps) {
    this.#props = freeze(props);
  }

  compile(): CompiledQuery<O> {
    return this.#props.queryCompiler.compileQuery<O>(this.#props.queryNode);
  }

  async execute(): Promise<readonly O[]> {
    if (!this.#props.queryExecutor) {
      throw new Error(
        "No query executor configured. Pass an executor when creating Kysoql.",
      );
    }

    return this.#props.queryExecutor.executeQuery(this.compile());
  }

  limit(limit: number): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithLimit(
        this.#props.queryNode,
        parseLimit(limit),
      ),
    });
  }

  offset(offset: number): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithOffset(
        this.#props.queryNode,
        parseOffset(offset),
      ),
    });
  }

  forView(
    ..._mruCheck: SalesforceObjectMruEnabled<DB[TB]> extends false
      ? readonly [mruDisabled: never]
      : readonly []
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithForViewReference(
        this.#props.queryNode,
        ForViewReferenceNode.create("view"),
      ),
    });
  }

  forReference(
    ..._mruCheck: SalesforceObjectMruEnabled<DB[TB]> extends false
      ? readonly [mruDisabled: never]
      : readonly []
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithForViewReference(
        this.#props.queryNode,
        ForViewReferenceNode.create("reference"),
      ),
    });
  }

  updateTracking(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithKnowledgeUpdateMode(
        this.#props.queryNode,
        "tracking",
      ),
    });
  }

  updateViewstat(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithKnowledgeUpdateMode(
        this.#props.queryNode,
        "viewstat",
      ),
    });
  }

  usingScope(
    scope: SalesforceObjectSupportedScope<DB[TB]>,
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithUsingScope(
        this.#props.queryNode,
        UsingScopeNode.create(scope),
      ),
    });
  }

  withUserId(
    userId: string,
    ..._userProfileFeedCheck: UserProfileFeedWithUserIdCheck<TB>
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithUserProfileFeedWith(
        this.#props.queryNode,
        parseUserProfileFeedWithUserId(userId),
      ),
    });
  }

  withDataCategory<Group extends SalesforceObjectDataCategoryGroup<DB[TB]>>(
    group: Group,
    selector: DataCategorySelector,
    categories: DataCategoryInput<SalesforceObjectDataCategory<DB[TB], Group>>,
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithDataCategorySelection(
        this.#props.queryNode,
        parseDataCategorySelection(group, selector, categories),
      ),
    });
  }

  orderBy(
    expression: DistanceOrderByFactory<DB, TB>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): SelectQueryBuilder<DB, TB, O, Mode>;
  orderBy<OE extends string>(
    field: OE & SortableFieldName<DB, TB, OE>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): SelectQueryBuilder<DB, TB, O, Mode>;
  orderBy(
    fieldOrExpression: string | DistanceOrderByFactory<DB, TB>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    const item =
      typeof fieldOrExpression === "function"
        ? parseDistanceOrderBy(
            fieldOrExpression(createGeolocationExpressionBuilder<DB, TB>()),
            direction,
            nulls,
          )
        : parseOrderBy(fieldOrExpression, direction, nulls);

    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithOrderByItems(this.#props.queryNode, [
        item,
      ]),
    });
  }

  where(
    expression: WhereExpressionFactory<DB, TB>,
  ): SelectQueryBuilder<DB, TB, O, Mode>;
  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): SelectQueryBuilder<DB, TB, O, Mode>;
  where(
    lhsOrExpression: string | WhereExpressionFactory<DB, TB>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    const operation =
      typeof lhsOrExpression === "function"
        ? lhsOrExpression(
            createExpressionBuilder<DB, TB>({
              outerObject: this.#props.queryNode.from.name,
            }),
          ).toOperationNode()
        : parseFilterBinaryOperation(
            lhsOrExpression,
            op as ComparisonOperator,
            rhs,
            { outerObject: this.#props.queryNode.from.name },
          );
    const queryNode = QueryNode.cloneWithWhere(
      this.#props.queryNode,
      operation,
    );

    validateSemiJoinWhere(queryNode.where?.where ?? operation);

    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode,
    });
  }

  select(
    selection: UnselectedOnly<O, CountSelectionFactory<DB, TB>>,
  ): CountQueryBuilder<DB, TB>;
  select<FunctionSelection extends SelectFunctionSelectionArg>(
    selection: SelectFunctionFactoryForMode<
      Mode,
      SelectFunctionSelectionFactory<DB, TB, FunctionSelection>
    >,
  ): SelectQueryBuilder<
    DB,
    TB,
    O & SelectFunctionSelection<FunctionSelection>,
    AfterSelectFunctionMode<Mode>
  >;
  select<Aggregate extends AggregateSelectionArg>(
    selection: UnselectedOnly<O, AggregateSelectionFactory<DB, TB, Aggregate>>,
  ): AggregateSelectQueryBuilder<DB, TB, AggregateSelection<Aggregate>>;
  select<SE extends string>(
    selections: ReadonlyArray<
      SE &
        SelectExpression<DB, TB, SE> &
        AvailableSelectExpression<DB, TB, O, SE>
    >,
  ): SelectQueryBuilder<DB, TB, O & Selection<DB, TB, SE>, Mode>;
  select<SE extends string>(
    selection: SE &
      SelectExpression<DB, TB, SE> &
      AvailableSelectExpression<DB, TB, O, SE>,
  ): SelectQueryBuilder<DB, TB, O & Selection<DB, TB, SE>, Mode>;
  select(
    selection:
      | string
      | readonly string[]
      | ((eb: SelectExpressionBuilder<DB, TB>) => unknown),
  ):
    | AggregateSelectQueryBuilder<DB, TB, unknown>
    | CountQueryBuilder<DB, TB>
    | SelectQueryBuilder<DB, TB, unknown> {
    if (typeof selection !== "function") {
      const queryNode = SelectQueryNode.cloneWithSelections(
        this.#props.queryNode,
        parseSelectArg(selection),
      );
      validateTypeOfSelections(queryNode);

      return new SelectQueryBuilderImpl<DB, TB, unknown, Mode>({
        ...this.#props,
        queryNode,
      });
    }

    const expression = selection(createSelectExpressionBuilder<DB, TB>());

    if (isSelectFunctionSelectionArg(expression)) {
      assertNoTypeOfSelections(this.#props.queryNode);

      const selections = parseSelectFunctionSelectArg(
        expression as SelectFunctionSelectionArg,
      );

      validateUniqueSelectFunctionAliases(
        this.#props.queryNode.selections ?? [],
        selections,
      );

      return new SelectQueryBuilderImpl<
        DB,
        TB,
        unknown,
        AfterSelectFunctionMode<Mode>
      >({
        ...this.#props,
        queryNode: SelectQueryNode.cloneWithSelections(
          this.#props.queryNode,
          selections,
        ),
      });
    }

    assertNoExistingSelections(this.#props.queryNode);

    if (isCountAllFunctionBuilder(expression)) {
      assertCountClauses(this.#props.queryNode);

      return createCountQueryBuilder<DB, TB>({
        ...this.#props,
        queryNode: SelectQueryNode.cloneWithSelections(this.#props.queryNode, [
          parseCountSelectArg(expression),
        ]),
      });
    }

    assertAggregateClauses(this.#props.queryNode);

    const selections = parseAggregateSelectArg(
      expression as AggregateSelectionArg,
    );

    validateGroupingSelections(selections, []);
    validateDateFunctionSelections(selections, []);

    return createAggregateSelectQueryBuilder<DB, TB, unknown>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithSelections(
        this.#props.queryNode,
        selections,
      ),
    });
  }

  selectFields<Selector extends FieldsSelector>(
    selector: Selector,
    ..._check: FieldsSelectionCheck<DB, TB, O, Selector>
  ): SelectQueryBuilder<DB, TB, O & FieldsSelection<DB, TB, Selector>, Mode> {
    return new SelectQueryBuilderImpl<
      DB,
      TB,
      O & FieldsSelection<DB, TB, Selector>,
      Mode
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithSelections(this.#props.queryNode, [
        parseFieldsSelection(selector),
      ]),
    });
  }

  selectTypeOf<
    Reference extends string,
    Builder extends CompletedTypeOfBuilder,
  >(
    reference: Reference &
      PolymorphicRelationshipReference<DB, TB, Reference> &
      AvailableTypeOfReference<O, Reference>,
    callback: (
      typeOf: TypeOfBuilder<
        DB,
        PolymorphicRelationshipTargets<DB, TB, Reference>
      >,
    ) => Builder,
    ..._modeCheck: TypeOfModeCheck<Mode>
  ): SelectQueryBuilder<
    DB,
    TB,
    O &
      TypeOfSelection<
        DB,
        TB,
        Reference,
        TypeOfValue<PolymorphicRelationshipTargets<DB, TB, Reference>, Builder>
      >,
    AfterTypeOfMode<Mode>
  > {
    assertNoSelectFunctionSelections(this.#props.queryNode);

    const typeOf = callback(
      createTypeOfBuilder<
        DB,
        PolymorphicRelationshipTargets<DB, TB, Reference>
      >(ReferenceNode.create(reference as string)),
    );

    if (
      typeof typeOf !== "object" ||
      typeOf === null ||
      !("toOperationNode" in typeOf) ||
      typeof typeOf.toOperationNode !== "function"
    ) {
      throw new TypeError("SOQL TYPEOF requires at least one WHEN branch.");
    }

    const node = typeOf.toOperationNode() as TypeOfNode;
    if (node.whens.length === 0) {
      throw new TypeError("SOQL TYPEOF requires at least one WHEN branch.");
    }

    const queryNode = SelectQueryNode.cloneWithSelections(
      this.#props.queryNode,
      [SelectionNode.create(node)],
    );
    validateTypeOfSelections(queryNode);

    return new SelectQueryBuilderImpl<
      DB,
      TB,
      O &
        TypeOfSelection<
          DB,
          TB,
          Reference,
          TypeOfValue<
            PolymorphicRelationshipTargets<DB, TB, Reference>,
            Builder
          >
        >,
      AfterTypeOfMode<Mode>
    >({
      ...this.#props,
      queryNode,
    });
  }

  selectSubquery<
    Relationship extends string,
    SubqueryOutput,
    SubqueryFunctionMode extends "none" | "present" | "forbidden",
  >(
    relationship: Relationship &
      ChildRelationshipReference<DB, TB, Relationship>,
    callback: (
      query: RelationshipSubqueryBuilder<
        DB,
        ChildObjectForRelationship<DB, TB, Relationship>,
        Record<never, never>,
        readonly [unknown],
        InitialSubqueryFunctionMode<Mode>
      >,
    ) => RelationshipSubqueryBuilder<
      DB,
      ChildObjectForRelationship<DB, TB, Relationship>,
      SubqueryOutput,
      readonly [unknown],
      SubqueryFunctionMode
    >,
  ): SelectQueryBuilder<
    DB,
    TB,
    O & {
      readonly [Key in Relationship]: SalesforceQueryResult<
        Simplify<SubqueryOutput>
      >;
    },
    AfterSubqueryMode<Mode, SubqueryFunctionMode>
  > {
    const subquery = callback(
      createRelationshipSubqueryBuilder<
        DB,
        ChildObjectForRelationship<DB, TB, Relationship>,
        Record<never, never>,
        readonly [unknown],
        InitialSubqueryFunctionMode<Mode>
      >({
        queryNode: RelationshipSubqueryNode.create(
          ReferenceNode.create(relationship),
        ),
      }),
    );

    const queryNode = SelectQueryNode.cloneWithSelections(
      this.#props.queryNode,
      [SelectionNode.create(subquery.toOperationNode())],
    );
    validateTypeOfSelections(queryNode);

    return new SelectQueryBuilderImpl<
      DB,
      TB,
      O & {
        readonly [Key in Relationship]: SalesforceQueryResult<
          Simplify<SubqueryOutput>
        >;
      },
      AfterSubqueryMode<Mode, SubqueryFunctionMode>
    >({
      ...this.#props,
      queryNode,
    });
  }

  toOperationNode(): SelectQueryNode {
    return this.#props.queryNode;
  }
}

export interface SelectQueryBuilderProps {
  readonly queryCompiler: QueryCompiler;
  readonly queryExecutor: QueryExecutor | undefined;
  readonly queryNode: SelectQueryNode;
}

export function createSelectQueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  Mode extends SelectQueryMode = "plain",
>(props: SelectQueryBuilderProps): SelectQueryBuilder<DB, TB, O, Mode> {
  return new SelectQueryBuilderImpl<DB, TB, O, Mode>(props);
}

function assertNoTypeOfSelections(queryNode: SelectQueryNode): void {
  if (
    queryNode.selections?.some(
      (selection) => selection.selection.kind === "TypeOfNode",
    )
  ) {
    throw new TypeError(
      "SOQL TYPEOF cannot be combined with SELECT function expressions.",
    );
  }
}

function assertNoSelectFunctionSelections(queryNode: SelectQueryNode): void {
  if (
    queryNode.selections?.some(
      (selection) => selection.selection.kind === "AliasNode",
    )
  ) {
    throw new TypeError(
      "SOQL TYPEOF cannot be combined with SELECT function expressions.",
    );
  }
}

function isCountAllFunctionBuilder(
  value: unknown,
): value is CountAllFunctionBuilder {
  if (
    typeof value !== "object" ||
    value === null ||
    !("toOperationNode" in value) ||
    typeof value.toOperationNode !== "function"
  ) {
    return false;
  }

  const node = value.toOperationNode();

  return (
    node.kind === "AggregateFunctionNode" &&
    node.function === "count" &&
    node.reference === undefined
  );
}

function assertNoExistingSelections(queryNode: SelectQueryNode): void {
  if (queryNode.selections?.length) {
    throw new TypeError(
      "Start SOQL aggregate mode before selecting grouped record fields.",
    );
  }
}

function assertAggregateClauses(queryNode: SelectQueryNode): void {
  if (queryNode.orderBy || queryNode.limit || queryNode.offset) {
    throw new TypeError(
      "SOQL aggregate queries without GROUP BY cannot use ORDER BY, LIMIT, or OFFSET.",
    );
  }
}

function assertCountClauses(queryNode: SelectQueryNode): void {
  if (queryNode.orderBy || queryNode.offset) {
    throw new TypeError("SOQL COUNT() queries cannot use ORDER BY or OFFSET.");
  }
}
