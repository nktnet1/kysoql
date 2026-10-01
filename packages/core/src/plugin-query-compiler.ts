import type { SelectQueryNode } from "#/operation-node/select-query-node";
import type { KysoqlPlugin } from "#/plugin";
import { setCompiledQueryId } from "#/plugin-query-correlation";
import { transformQueryWithPlugins } from "#/plugin-query-transformer";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type {
  QueryCompileContext,
  QueryCompiler,
} from "#/query-compiler/query-compiler";
import { createQueryId } from "#/query-id";

export class PluginQueryCompiler implements QueryCompiler {
  readonly #compiler: QueryCompiler;
  readonly #plugins: readonly KysoqlPlugin[];

  constructor(compiler: QueryCompiler, plugins: readonly KysoqlPlugin[]) {
    this.#compiler = compiler;
    this.#plugins = plugins;
  }

  compileQuery<O = unknown>(
    query: SelectQueryNode,
    context?: QueryCompileContext,
  ): CompiledQuery<O> {
    const queryId = context?.queryId ?? createQueryId();
    const compiledQuery = this.#compiler.compileQuery<O>(
      transformQueryWithPlugins(query, this.#plugins, queryId),
      context,
    );
    setCompiledQueryId(compiledQuery, queryId);
    return compiledQuery;
  }
}
