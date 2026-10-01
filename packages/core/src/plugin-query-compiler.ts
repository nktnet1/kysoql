import type { SelectQueryNode } from "#src/operation-node/select-query-node";
import type { KysoqlPlugin } from "#src/plugin";
import { setCompiledQueryId } from "#src/plugin-query-correlation";
import { transformQueryWithPlugins } from "#src/plugin-query-transformer";
import type { CompiledQuery } from "#src/query-compiler/compiled-query";
import type {
  QueryCompileContext,
  QueryCompiler,
} from "#src/query-compiler/query-compiler";
import { createQueryId } from "#src/query-id";

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
