import { QueryNode } from "#/operation-node/query-node";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import type { QueryExecutor } from "#/query-executor";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import { parseLimit } from "#/parser/limit-parser";
import { parseOffset } from "#/parser/offset-parser";
import {
  parseValueBinaryOperation,
  type ComparisonOperatorExpression,
  type FilterableFieldName,
  type OperandValueExpression,
} from "#/parser/binary-operation-parser";
import {
  parseSelectArg,
  type SelectArg,
  type SelectExpression,
  type Selection,
} from "#/parser/select-parser";
import {
  parseOrderBy,
  type SortableFieldName,
} from "#/parser/order-by-parser";
import type {
  OrderByDirection,
  OrderByNulls,
} from "#/operation-node/order-by-item-node";
import { freeze } from "#/util/object-utils";

export interface SelectQueryBuilder<DB, TB extends keyof DB, O> {
  compile(): CompiledQuery<O>;

  execute(): Promise<readonly O[]>;

  limit(limit: number): SelectQueryBuilder<DB, TB, O>;

  offset(offset: number): SelectQueryBuilder<DB, TB, O>;

  orderBy<OE extends SortableFieldName<DB, TB>>(
    field: OE,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): SelectQueryBuilder<DB, TB, O>;

  where<
    RE extends FilterableFieldName<DB, TB>,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
  >(
    lhs: RE,
    op: OP,
    rhs: OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  ): SelectQueryBuilder<DB, TB, O>;

  select<SE extends SelectExpression<DB, TB>>(
    selections: ReadonlyArray<SE>,
  ): SelectQueryBuilder<DB, TB, O & Selection<DB, TB, SE>>;

  select<SE extends SelectExpression<DB, TB>>(
    selection: SE,
  ): SelectQueryBuilder<DB, TB, O & Selection<DB, TB, SE>>;

  toOperationNode(): SelectQueryNode;
}

class SelectQueryBuilderImpl<DB, TB extends keyof DB, O>
  implements SelectQueryBuilder<DB, TB, O>
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

  limit(limit: number): SelectQueryBuilder<DB, TB, O> {
    return new SelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithLimit(
        this.#props.queryNode,
        parseLimit(limit),
      ),
    });
  }

  offset(offset: number): SelectQueryBuilder<DB, TB, O> {
    return new SelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithOffset(
        this.#props.queryNode,
        parseOffset(offset),
      ),
    });
  }

  orderBy<OE extends SortableFieldName<DB, TB>>(
    field: OE,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): SelectQueryBuilder<DB, TB, O> {
    return new SelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithOrderByItems(this.#props.queryNode, [
        parseOrderBy(field, direction, nulls),
      ]),
    });
  }

  where<
    RE extends FilterableFieldName<DB, TB>,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
  >(
    lhs: RE,
    op: OP,
    rhs: OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  ): SelectQueryBuilder<DB, TB, O> {
    return new SelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode: QueryNode.cloneWithWhere(
        this.#props.queryNode,
        parseValueBinaryOperation(lhs, op, rhs),
      ),
    });
  }

  select<SE extends SelectExpression<DB, TB>>(
    selection: SelectArg<DB, TB, SE>,
  ): SelectQueryBuilder<DB, TB, O & Selection<DB, TB, SE>> {
    return new SelectQueryBuilderImpl<DB, TB, O & Selection<DB, TB, SE>>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithSelections(
        this.#props.queryNode,
        parseSelectArg(selection),
      ),
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

export function createSelectQueryBuilder<DB, TB extends keyof DB, O>(
  props: SelectQueryBuilderProps,
): SelectQueryBuilder<DB, TB, O> {
  return new SelectQueryBuilderImpl(props);
}
