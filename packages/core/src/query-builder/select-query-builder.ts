import { SelectQueryNode } from "../operation-node/select-query-node.js";
import {
  parseSelectArg,
  type SelectArg,
  type SelectExpression,
  type Selection,
} from "../parser/select-parser.js";
import { freeze } from "../util/object-utils.js";

export interface SelectQueryBuilder<DB, TB extends keyof DB, O> {
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
  readonly queryNode: SelectQueryNode;
}

export function createSelectQueryBuilder<DB, TB extends keyof DB, O>(
  props: SelectQueryBuilderProps,
): SelectQueryBuilder<DB, TB, O> {
  return new SelectQueryBuilderImpl(props);
}
