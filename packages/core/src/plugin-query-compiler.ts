import type { SelectQueryNode } from "#/operation-node/select-query-node";
import type { KysoqlPlugin } from "#/plugin";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type {
  QueryCompileContext,
  QueryCompiler,
} from "#/query-compiler/query-compiler";

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
    let transformedQuery = query;

    for (const plugin of this.#plugins) {
      transformedQuery = plugin.transformQuery({ query: transformedQuery });
    }

    return this.#compiler.compileQuery<O>(transformedQuery, context);
  }
}
