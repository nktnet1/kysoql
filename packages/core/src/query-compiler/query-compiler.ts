import type { SelectQueryNode } from "../operation-node/select-query-node.js";
import type { CompiledQuery } from "./compiled-query.js";

export interface QueryCompiler {
  compileQuery<O = unknown>(query: SelectQueryNode): CompiledQuery<O>;
}
