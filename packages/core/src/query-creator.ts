import { SelectQueryNode } from "#src/operation-node/select-query-node";
import { SObjectNode } from "#src/operation-node/sobject-node";
import type { KysoqlPlugin } from "#src/plugin";
import { PluginQueryCompiler } from "#src/plugin-query-compiler";
import { createPluginQueryExecutor } from "#src/plugin-query-executor";
import { transformQueryWithPlugins } from "#src/plugin-query-transformer";
import {
  createSelectQueryBuilder,
  type SelectQueryBuilder,
} from "#src/query-builder/select-query-builder";
import type { CompiledQuery } from "#src/query-compiler/compiled-query";
import { DefaultQueryCompiler } from "#src/query-compiler/default-query-compiler";
import type { QueryCompiler } from "#src/query-compiler/query-compiler";
import type { AbortableQueryOptions, QueryExecutor } from "#src/query-executor";
import { createQueryId } from "#src/query-id";
import { applyQueryResultAliases } from "#src/query-result-mapper";
import type { SalesforceSchemaMetadata } from "#src/schema";

/** Compiler, executor, and plugin configuration for QueryCreator. */
export interface QueryCreatorConfig {
  /** Executor used by query builders created from this configuration. */
  readonly executor?: QueryExecutor;
  /** Compiler used to turn operation trees into SOQL. */
  readonly queryCompiler?: QueryCompiler;
  /** Optional generated-schema metadata used for capability validation. */
  readonly schemaMetadata?: SalesforceSchemaMetadata;
  /** Plugins applied in order to created queries and results. */
  readonly plugins?: readonly KysoqlPlugin[];
}

const isQueryCompiler = (
  value: QueryCreatorConfig | QueryCompiler,
): value is QueryCompiler => "compileQuery" in value;

/** Entry point for creating typed queries from a Salesforce schema. */
export class QueryCreator<DB> {
  readonly #baseQueryCompiler: QueryCompiler;
  readonly #baseQueryExecutor: QueryExecutor | undefined;
  readonly #plugins: readonly KysoqlPlugin[];
  readonly #queryCompiler: QueryCompiler;
  readonly #queryExecutor: QueryExecutor | undefined;

  /** Creates a query entry point from compiler, executor, schema metadata, and plugin configuration. */
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

  /** Returns a `QueryCreator` with the plugin appended to the execution pipeline. */
  withPlugin(plugin: KysoqlPlugin): this {
    return this.#cloneWithPlugins([...this.#plugins, plugin]);
  }

  /** Returns a `QueryCreator` with all plugins removed. */
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
      ...(this.#baseQueryExecutor ? { executor: this.#baseQueryExecutor } : {}),
      plugins,
    });
  }

  /** Starts a typed query for the specified Salesforce object. */
  selectFrom<TB extends keyof DB & string>(
    from: TB,
  ): SelectQueryBuilder<DB, TB, unknown, "plain"> {
    const queryId = createQueryId();

    return createSelectQueryBuilder({
      queryCompiler: this.#queryCompiler,
      queryExecutor: this.#queryExecutor,
      queryId,
      queryNode: SelectQueryNode.createFrom(SObjectNode.create(from)),
      ...(this.#plugins.length > 0
        ? {
            queryNodeTransformer: (query: SelectQueryNode) =>
              transformQueryWithPlugins(query, this.#plugins, queryId),
          }
        : {}),
    });
  }

  /** Executes a supplied operation tree through this creator's compiler, plugins, and executor. */
  executeQuery(
    compiledQuery: CompiledQuery<number>,
    options?: AbortableQueryOptions,
  ): Promise<number>;
  /** Executes a supplied operation tree through this creator's compiler, plugins, and executor. */
  executeQuery<O>(
    compiledQuery: CompiledQuery<O>,
    options?: AbortableQueryOptions,
  ): Promise<readonly O[]>;
  /** Executes a supplied operation tree through this creator's compiler, plugins, and executor. */
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
