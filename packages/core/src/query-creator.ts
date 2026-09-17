import { SelectQueryNode } from "./operation-node/select-query-node.js";
import { DefaultQueryCompiler } from "./query-compiler/default-query-compiler.js";
import type { QueryCompiler } from "./query-compiler/query-compiler.js";
import type { QueryExecutor } from "./query-executor.js";
import { SObjectNode } from "./operation-node/sobject-node.js";
import {
  createSelectQueryBuilder,
  type SelectQueryBuilder,
} from "./query-builder/select-query-builder.js";

export interface QueryCreatorConfig {
  readonly executor?: QueryExecutor;
  readonly queryCompiler?: QueryCompiler;
}

const isQueryCompiler = (
  value: QueryCreatorConfig | QueryCompiler,
): value is QueryCompiler => "compileQuery" in value;

export class QueryCreator<DB> {
  readonly #queryCompiler: QueryCompiler;
  readonly #queryExecutor: QueryExecutor | undefined;

  constructor(
    configOrQueryCompiler: QueryCreatorConfig | QueryCompiler = {},
  ) {
    const config: QueryCreatorConfig = isQueryCompiler(configOrQueryCompiler)
      ? { queryCompiler: configOrQueryCompiler }
      : configOrQueryCompiler;

    this.#queryCompiler = config.queryCompiler ?? new DefaultQueryCompiler();
    this.#queryExecutor = config.executor;
  }

  selectFrom<TB extends keyof DB & string>(
    from: TB,
  ): SelectQueryBuilder<DB, TB, Record<never, never>> {
    return createSelectQueryBuilder({
      queryCompiler: this.#queryCompiler,
      queryExecutor: this.#queryExecutor,
      queryNode: SelectQueryNode.createFrom(SObjectNode.create(from)),
    });
  }
}
