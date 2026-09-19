import { ForUpdateNode } from "#/operation-node/for-update-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import type { SelectQueryBuilderProps } from "#/query-builder/select-query-builder";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import { freeze } from "#/util/object-utils";

export interface ApexSelectQueryBuilder<DB, TB extends keyof DB, O> {
  compile(): CompiledQuery<O>;

  forUpdate(): ApexSelectQueryBuilder<DB, TB, O>;

  toOperationNode(): SelectQueryNode;
}

class ApexSelectQueryBuilderImpl<DB, TB extends keyof DB, O>
  implements ApexSelectQueryBuilder<DB, TB, O>
{
  readonly #props: SelectQueryBuilderProps;

  constructor(props: SelectQueryBuilderProps) {
    this.#props = freeze(props);
  }

  compile(): CompiledQuery<O> {
    return this.#props.queryCompiler.compileQuery<O>(this.#props.queryNode);
  }

  forUpdate(): ApexSelectQueryBuilder<DB, TB, O> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithForUpdate(
        this.#props.queryNode,
        ForUpdateNode.create(),
      ),
    });
  }

  toOperationNode(): SelectQueryNode {
    return this.#props.queryNode;
  }
}

export function createApexSelectQueryBuilder<DB, TB extends keyof DB, O>(
  props: SelectQueryBuilderProps,
): ApexSelectQueryBuilder<DB, TB, O> {
  return new ApexSelectQueryBuilderImpl<DB, TB, O>(props);
}
