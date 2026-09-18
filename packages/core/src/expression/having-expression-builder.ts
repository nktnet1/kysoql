import {
  type AggregateFunctionExpression,
  type AggregateFunctionModule,
  createSelectExpressionBuilder,
  type DateFunctionExpression,
} from "#/expression/aggregate-function-builder";
import { AndNode } from "#/operation-node/and-node";
import { NotNode } from "#/operation-node/not-node";
import type { OperationNode } from "#/operation-node/operation-node";
import type {
  ComparisonOperator,
  LikeComparisonOperator,
  MultiSelectComparisonOperator,
  OrderedComparisonOperator,
  SetComparisonOperator,
} from "#/operation-node/operator-node";
import { OrNode } from "#/operation-node/or-node";
import {
  type ComparisonOperatorExpression,
  type OperandValueExpression,
  parseOperationValueBinaryOperation,
} from "#/parser/binary-operation-parser";
import { validateGroupedDateFunctionNode } from "#/parser/date-function-parser";
import { parseFilterBinaryOperation } from "#/parser/filter-parser";
import type { GroupableFieldName } from "#/parser/group-by-parser";
import { validateGroupingFunctionNode } from "#/parser/grouping-expression-parser";

const HAVING_FIELD_GROUP_ERROR =
  "SOQL HAVING field references must also appear in GROUP BY.";
const HAVING_AGGREGATE_EXPRESSION_ERROR =
  "SOQL HAVING aggregate operands must be unaliased aggregate function expressions.";

declare const havingExpressionType: unique symbol;

export type GroupedHavingFieldName<
  DB,
  TB extends keyof DB,
  GroupedBy extends string,
  Reference extends string,
> = Reference extends GroupedBy ? GroupableFieldName<DB, TB, Reference> : never;

type AggregateOperandValue<
  Value,
  Operator extends ComparisonOperator,
> = Operator extends LikeComparisonOperator
  ? Extract<NonNullable<Value>, string>
  : Operator extends OrderedComparisonOperator
    ? NonNullable<Value>
    : Operator extends SetComparisonOperator | MultiSelectComparisonOperator
      ? readonly Value[]
      : Value;

export interface HavingExpressionWrapper<
  DB,
  TB extends keyof DB,
  GroupedBy extends string,
> {
  readonly [havingExpressionType]: {
    readonly db: DB;
    readonly table: TB;
    readonly groupedBy: GroupedBy;
  };

  toOperationNode(): OperationNode;
}

export interface HavingExpressionBuilder<
  DB,
  TB extends keyof DB,
  GroupedBy extends string,
  GroupingFields extends string = never,
> {
  <
    Reference extends string,
    Operator extends ComparisonOperatorExpression<DB, TB, Reference>,
    Right extends OperandValueExpression<
      DB,
      TB,
      Reference,
      NoInfer<Operator>,
      false
    >,
  >(
    lhs: Reference & GroupedHavingFieldName<DB, TB, GroupedBy, Reference>,
    op: Operator,
    rhs: Right,
  ): HavingExpressionWrapper<DB, TB, GroupedBy>;

  <
    Output,
    Value,
    AllowedOperator extends ComparisonOperator,
    Operator extends AllowedOperator,
    Right extends AggregateOperandValue<Value, NoInfer<Operator>>,
  >(
    lhs: AggregateFunctionExpression<Output, Value, AllowedOperator>,
    op: Operator,
    rhs: Right,
  ): HavingExpressionWrapper<DB, TB, GroupedBy>;

  <
    Output,
    Value,
    AllowedOperator extends ComparisonOperator,
    Identity extends GroupedBy,
    Operator extends AllowedOperator,
    Right extends AggregateOperandValue<Value, NoInfer<Operator>>,
  >(
    lhs: DateFunctionExpression<Output, Value, AllowedOperator, Identity>,
    op: Operator,
    rhs: Right,
  ): HavingExpressionWrapper<DB, TB, GroupedBy>;

  readonly fn: AggregateFunctionModule<DB, TB, GroupingFields>;

  and(
    expressions: readonly [
      HavingExpressionWrapper<DB, TB, GroupedBy>,
      HavingExpressionWrapper<DB, TB, GroupedBy>,
      ...HavingExpressionWrapper<DB, TB, GroupedBy>[],
    ],
  ): HavingExpressionWrapper<DB, TB, GroupedBy>;

  not(
    expression: HavingExpressionWrapper<DB, TB, GroupedBy>,
  ): HavingExpressionWrapper<DB, TB, GroupedBy>;

  or(
    expressions: readonly [
      HavingExpressionWrapper<DB, TB, GroupedBy>,
      HavingExpressionWrapper<DB, TB, GroupedBy>,
      ...HavingExpressionWrapper<DB, TB, GroupedBy>[],
    ],
  ): HavingExpressionWrapper<DB, TB, GroupedBy>;
}

export type HavingExpressionFactory<
  DB,
  TB extends keyof DB,
  GroupedBy extends string,
  GroupingFields extends string = never,
> = (
  eb: HavingExpressionBuilder<DB, TB, GroupedBy, GroupingFields>,
) => HavingExpressionWrapper<DB, TB, GroupedBy>;

class HavingExpressionWrapperImpl<
  DB,
  TB extends keyof DB,
  GroupedBy extends string,
> implements HavingExpressionWrapper<DB, TB, GroupedBy>
{
  declare readonly [havingExpressionType]: {
    readonly db: DB;
    readonly table: TB;
    readonly groupedBy: GroupedBy;
  };

  readonly #node: OperationNode;

  constructor(node: OperationNode) {
    this.#node = node;
  }

  toOperationNode(): OperationNode {
    return this.#node;
  }
}

export interface HavingExpressionBuilderOptions {
  readonly groupedBy: readonly string[];
  readonly groupingFields: readonly string[];
}

export function createHavingExpressionBuilder<
  DB,
  TB extends keyof DB,
  GroupedBy extends string,
  GroupingFields extends string = never,
>(
  options: HavingExpressionBuilderOptions,
): HavingExpressionBuilder<DB, TB, GroupedBy, GroupingFields> {
  const expression = (
    lhs:
      | string
      | AggregateFunctionExpression<unknown, unknown>
      | DateFunctionExpression<unknown, unknown, ComparisonOperator, string>,
    op: ComparisonOperator,
    rhs: unknown,
  ): HavingExpressionWrapper<DB, TB, GroupedBy> =>
    new HavingExpressionWrapperImpl<DB, TB, GroupedBy>(
      typeof lhs === "string"
        ? parseGroupedFieldBinaryOperation(lhs, op, rhs, options.groupedBy)
        : parseFunctionBinaryOperation(
            lhs,
            op,
            rhs,
            options.groupedBy,
            options.groupingFields,
          ),
    );

  const and = (
    expressions: readonly [
      HavingExpressionWrapper<DB, TB, GroupedBy>,
      HavingExpressionWrapper<DB, TB, GroupedBy>,
      ...HavingExpressionWrapper<DB, TB, GroupedBy>[],
    ],
  ): HavingExpressionWrapper<DB, TB, GroupedBy> => {
    const [first, second, ...rest] = expressions;
    let operation = AndNode.create(
      first.toOperationNode(),
      second.toOperationNode(),
    );

    for (const item of rest) {
      operation = AndNode.create(operation, item.toOperationNode());
    }

    return new HavingExpressionWrapperImpl<DB, TB, GroupedBy>(operation);
  };

  const not = (
    operand: HavingExpressionWrapper<DB, TB, GroupedBy>,
  ): HavingExpressionWrapper<DB, TB, GroupedBy> =>
    new HavingExpressionWrapperImpl<DB, TB, GroupedBy>(
      NotNode.create(operand.toOperationNode()),
    );

  const or = (
    expressions: readonly [
      HavingExpressionWrapper<DB, TB, GroupedBy>,
      HavingExpressionWrapper<DB, TB, GroupedBy>,
      ...HavingExpressionWrapper<DB, TB, GroupedBy>[],
    ],
  ): HavingExpressionWrapper<DB, TB, GroupedBy> => {
    const [first, second, ...rest] = expressions;
    let operation = OrNode.create(
      first.toOperationNode(),
      second.toOperationNode(),
    );

    for (const item of rest) {
      operation = OrNode.create(operation, item.toOperationNode());
    }

    return new HavingExpressionWrapperImpl<DB, TB, GroupedBy>(operation);
  };

  return Object.assign(expression, {
    and,
    fn: createSelectExpressionBuilder<DB, TB, GroupingFields>({
      groupingFields: options.groupingFields,
    }).fn,
    not,
    or,
  }) as HavingExpressionBuilder<DB, TB, GroupedBy, GroupingFields>;
}

function parseGroupedFieldBinaryOperation(
  field: string,
  operator: ComparisonOperator,
  value: unknown,
  groupedBy: readonly string[],
): OperationNode {
  if (!groupedBy.includes(field)) {
    throw new TypeError(HAVING_FIELD_GROUP_ERROR);
  }

  return parseFilterBinaryOperation(field, operator, value, {
    allowSemiJoin: false,
  });
}

function parseFunctionBinaryOperation(
  expression:
    | AggregateFunctionExpression<unknown, unknown>
    | DateFunctionExpression<unknown, unknown, ComparisonOperator, string>,
  operator: ComparisonOperator,
  value: unknown,
  groupedBy: readonly string[],
  groupingFields: readonly string[],
): OperationNode {
  const node = expression.toOperationNode();

  if (
    node.kind !== "AggregateFunctionNode" &&
    node.kind !== "DateFunctionNode"
  ) {
    throw new TypeError(HAVING_AGGREGATE_EXPRESSION_ERROR);
  }

  if (node.kind === "DateFunctionNode") {
    validateGroupedDateFunctionNode(node, groupedBy);
  } else if (node.function === "grouping") {
    validateGroupingFunctionNode(node, groupingFields);
  }

  return parseOperationValueBinaryOperation(node, operator, value);
}
