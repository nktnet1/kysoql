import { SelectQueryNode } from "./operation-node/select-query-node.js";
import { DefaultQueryCompiler } from "./query-compiler/default-query-compiler.js";
import type { QueryCompiler } from "./query-compiler/query-compiler.js";
import { SObjectNode } from "./operation-node/sobject-node.js";
import {
  createSelectQueryBuilder,
  type SelectQueryBuilder,
} from "./query-builder/select-query-builder.js";

export class QueryCreator<DB> {
  readonly #queryCompiler: QueryCompiler;

  constructor(queryCompiler: QueryCompiler = new DefaultQueryCompiler()) {
    this.#queryCompiler = queryCompiler;
  }

  selectFrom<TB extends keyof DB & string>(
    from: TB,
  ): SelectQueryBuilder<DB, TB, Record<never, never>> {
    return createSelectQueryBuilder({
      queryCompiler: this.#queryCompiler,
      queryNode: SelectQueryNode.createFrom(SObjectNode.create(from)),
    });
  }
}
