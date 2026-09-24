import { SelectQueryNode } from "#/operation-node/select-query-node";
import { SObjectNode } from "#/operation-node/sobject-node";
import {
  createSelectQueryBuilder,
  type SelectQueryBuilder,
} from "#/query-builder/select-query-builder";
import { DefaultQueryCompiler } from "#/query-compiler/default-query-compiler";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { KysoqlPlugin } from "#/plugin";
import { createQueryId } from "#/query-id";
import { transformQueryWithPlugins } from "#/plugin-query-transformer";
import { PluginQueryCompiler } from "#/plugin-query-compiler";
import { createPluginQueryExecutor } from "#/plugin-query-executor";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import type { AbortableQueryOptions, QueryExecutor } from "#/query-executor";
import { applyQueryResultAliases } from "#/query-result-mapper";
import type { SalesforceSchemaMetadata } from "#/schema";

export interface QueryCreatorConfig {
  readonly executor?: QueryExecutor;
  readonly queryCompiler?: QueryCompiler;
  readonly schemaMetadata?: SalesforceSchemaMetadata;
  readonly plugins?: readonly KysoqlPlugin[];
}

const isQueryCompiler = (
  value: QueryCreatorConfig | QueryCompiler,
): value is QueryCompiler => "compileQuery" in value;

export class QueryCreator<DB> {
  readonly #baseQueryCompiler: QueryCompiler;
  readonly #baseQueryExecutor: QueryExecutor | undefined;
  readonly #plugins: readonly KysoqlPlugin[];
  readonly #queryCompiler: QueryCompiler;
  readonly #queryExecutor: QueryExecutor | undefined;

  constructor(configOrQueryCompiler: QueryCreatorConfig | QueryCompiler = {}) {
    const config: QueryCreatorConfig = isQueryCompiler(configOrQueryCompiler)
      ? { queryCompiler: configOrQueryCompiler }
      : configOrQueryCompiler;

    this.#baseQueryCompiler =
      config.queryCompiler ?? new DefaultQueryCompiler(config.schemaMetadata);
    this.#baseQueryExecutor = config.executor;
    this.#plugins = [...(config.plugins ?? [])];
    this.#queryCompiler =
      this.#plugins.length === 0
        ? this.#baseQueryCompiler
        : new PluginQueryCompiler(this.#baseQueryCompiler, this.#plugins);
    this.#queryExecutor =
      !this.#baseQueryExecutor || this.#plugins.length === 0
        ? this.#baseQueryExecutor
        : createPluginQueryExecutor(this.#baseQueryExecutor, this.#plugins);
  }

  withPlugin(plugin: KysoqlPlugin): this {
    return this.#cloneWithPlugins([...this.#plugins, plugin]);
  }

  withoutPlugins(): this {
    if (this.#plugins.length === 0) {
      return this;
    }

    return this.#cloneWithPlugins([]);
  }

  #cloneWithPlugins(plugins: readonly KysoqlPlugin[]): this {
    const Constructor = this.constructor as new (
      config: QueryCreatorConfig,
    ) => this;

    return new Constructor({
      queryCompiler: this.#baseQueryCompiler,
      ...(this.#baseQueryExecutor
        ? { executor: this.#baseQueryExecutor }
        : {}),
      plugins,
    });
  }

  selectFrom<TB extends keyof DB & string>(
    from: TB,
  ): SelectQueryBuilder<DB, TB, unknown, "plain"> {
    return createSelectQueryBuilder({
      queryCompiler: this.#queryCompiler,
      queryExecutor: this.#queryExecutor,
      queryNode: SelectQueryNode.createFrom(SObjectNode.create(from)),
      ...(this.#plugins.length > 0
        ? {
            queryNodeTransformer: (query: SelectQueryNode) =>
              transformQueryWithPlugins(query, this.#plugins, createQueryId()),
          }
        : {}),
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
