import { SelectQueryNode } from "#/operation-node/select-query-node";
import { SObjectNode } from "#/operation-node/sobject-node";
import {
  createSelectQueryBuilder,
  type SelectQueryBuilder,
} from "#/query-builder/select-query-builder";
import { DefaultQueryCompiler } from "#/query-compiler/default-query-compiler";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import type { QueryExecutor } from "#/query-executor";

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

  constructor(configOrQueryCompiler: QueryCreatorConfig | QueryCompiler = {}) {
    const config: QueryCreatorConfig = isQueryCompiler(configOrQueryCompiler)
      ? { queryCompiler: configOrQueryCompiler }
      : configOrQueryCompiler;

    this.#queryCompiler = config.queryCompiler ?? new DefaultQueryCompiler();
    this.#queryExecutor = config.executor;
  }

  selectFrom<TB extends keyof DB & string>(
    from: TB,
  ): SelectQueryBuilder<DB, TB, unknown, "plain"> {
    return createSelectQueryBuilder({
      queryCompiler: this.#queryCompiler,
      queryExecutor: this.#queryExecutor,
      queryNode: SelectQueryNode.createFrom(SObjectNode.create(from)),
    });
  }
}
