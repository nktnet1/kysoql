import { SelectQueryNode } from "#/operation-node/select-query-node";
import { SObjectNode } from "#/operation-node/sobject-node";
import {
  createSelectQueryBuilder,
  type SelectQueryBuilder,
} from "#/query-builder/select-query-builder";
import { DefaultQueryCompiler } from "#/query-compiler/default-query-compiler";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import type { AbortableQueryOptions, QueryExecutor } from "#/query-executor";
import { applyQueryResultAliases } from "#/query-result-mapper";
import type { SalesforceSchemaMetadata } from "#/schema";

export interface QueryCreatorConfig {
  readonly executor?: QueryExecutor;
  readonly queryCompiler?: QueryCompiler;
  readonly schemaMetadata?: SalesforceSchemaMetadata;
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

    this.#queryCompiler =
      config.queryCompiler ?? new DefaultQueryCompiler(config.schemaMetadata);
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

  executeQuery(
    compiledQuery: CompiledQuery<number>,
    options?: AbortableQueryOptions,
  ): Promise<number>;
  executeQuery<O>(
    compiledQuery: CompiledQuery<O>,
    options?: AbortableQueryOptions,
  ): Promise<readonly O[]>;
  async executeQuery<O>(
    compiledQuery: CompiledQuery<O>,
    options?: AbortableQueryOptions,
  ): Promise<number | readonly O[]> {
    if (!this.#queryExecutor) {
      throw new Error(
        "No query executor configured. Pass an executor when creating Kysoql.",
      );
    }

    const selections = compiledQuery.query.selections;
    const selection =
      selections?.length === 1 ? selections[0]?.selection : undefined;
    if (
      selection?.kind === "AggregateFunctionNode" &&
      selection.function === "count" &&
      selection.reference === undefined
    ) {
      if (!this.#queryExecutor.executeCountQuery) {
        throw new Error(
          "The configured query executor does not support SOQL COUNT() queries.",
        );
      }

      return this.#queryExecutor.executeCountQuery(
        compiledQuery as CompiledQuery<number>,
        options,
      );
    }

    const records = await this.#queryExecutor.executeQuery(
      compiledQuery,
      options,
    );
    return applyQueryResultAliases<O>(
      compiledQuery.query,
      records as unknown as readonly Record<string, unknown>[],
    );
  }
}
