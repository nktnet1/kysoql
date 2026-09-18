import {
  createSelectExpressionBuilder,
  type SelectExpressionBuilder,
} from "#/expression/aggregate-function-builder";
import {
  createExpressionBuilder,
  type WhereExpressionFactory,
} from "#/expression/expression-builder";
import type { ComparisonOperator } from "#/operation-node/operator-node";
import { QueryNode } from "#/operation-node/query-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import type { SelectionNode } from "#/operation-node/selection-node";
import {
  type ComparisonOperatorExpression,
  type FilterableFieldName,
  type OperandValueExpression,
} from "#/parser/binary-operation-parser";
import {
  type AggregateSelection,
  type AggregateSelectionArg,
  parseAggregateSelectArg,
} from "#/parser/aggregate-selection-parser";
import {
  parseFilterBinaryOperation,
  validateSemiJoinWhere,
} from "#/parser/filter-parser";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import type { QueryExecutor } from "#/query-executor";
import { freeze } from "#/util/object-utils";

export interface AggregateSelectQueryBuilder<DB, TB extends keyof DB, O> {
  compile(): CompiledQuery<O>;

  execute(): Promise<readonly O[]>;

  select<Selection extends AggregateSelectionArg>(
    selection: (
      eb: SelectExpressionBuilder<DB, TB>,
    ) => Selection,
  ): AggregateSelectQueryBuilder<DB, TB, O & AggregateSelection<Selection>>;

  where(
    expression: WhereExpressionFactory<DB, TB>,
  ): AggregateSelectQueryBuilder<DB, TB, O>;

  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): AggregateSelectQueryBuilder<DB, TB, O>;

  toOperationNode(): SelectQueryNode;
}

class AggregateSelectQueryBuilderImpl<DB, TB extends keyof DB, O>
  implements AggregateSelectQueryBuilder<DB, TB, O>
{
  readonly #props: AggregateSelectQueryBuilderProps;

  constructor(props: AggregateSelectQueryBuilderProps) {
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

  select<Selection extends AggregateSelectionArg>(
    selection: (
      eb: SelectExpressionBuilder<DB, TB>,
    ) => Selection,
  ): AggregateSelectQueryBuilder<DB, TB, O & AggregateSelection<Selection>> {
    const parsedSelections = parseAggregateSelectArg(
      selection(createSelectExpressionBuilder<DB, TB>()),
    );

    validateUniqueAliases(this.#props.queryNode, parsedSelections);

    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O & AggregateSelection<Selection>
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithSelections(
        this.#props.queryNode,
        parsedSelections,
      ),
    });
  }

  where(
    expression: WhereExpressionFactory<DB, TB>,
  ): AggregateSelectQueryBuilder<DB, TB, O>;
  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): AggregateSelectQueryBuilder<DB, TB, O>;
  where(
    lhsOrExpression: string | WhereExpressionFactory<DB, TB>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): AggregateSelectQueryBuilder<DB, TB, O> {
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

    return new AggregateSelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode,
    });
  }

  toOperationNode(): SelectQueryNode {
    return this.#props.queryNode;
  }
}

export interface AggregateSelectQueryBuilderProps {
  readonly queryCompiler: QueryCompiler;
  readonly queryExecutor: QueryExecutor | undefined;
  readonly queryNode: SelectQueryNode;
}

export function createAggregateSelectQueryBuilder<
  DB,
  TB extends keyof DB,
  O,
>(
  props: AggregateSelectQueryBuilderProps,
): AggregateSelectQueryBuilder<DB, TB, O> {
  return new AggregateSelectQueryBuilderImpl(props);
}

function validateUniqueAliases(
  queryNode: SelectQueryNode,
  selections: readonly SelectionNode[],
): void {
  const aliases = new Set<string>();

  for (const selection of queryNode.selections ?? []) {
    if (selection.selection.kind === "AliasNode") {
      aliases.add(selection.selection.alias);
    }
  }

  for (const selection of selections) {
    if (selection.selection.kind !== "AliasNode") {
      continue;
    }

    if (aliases.has(selection.selection.alias)) {
      throw new TypeError(
        `Duplicate SOQL aggregate selection alias: ${selection.selection.alias}.`,
      );
    }

    aliases.add(selection.selection.alias);
  }
}
