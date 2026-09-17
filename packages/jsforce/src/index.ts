import type { CompiledQuery, QueryExecutor } from "@kysoql/core";

export interface JsforceQueryResult {
  readonly done: boolean;
  readonly nextRecordsUrl?: string;
  readonly records: readonly Record<string, unknown>[];
}

export interface JsforceConnection {
  query(soql: string): PromiseLike<JsforceQueryResult>;
  queryMore(locator: string): PromiseLike<JsforceQueryResult>;
}

export type JsforceExecutor = QueryExecutor;

class JsforceQueryExecutor implements QueryExecutor {
  readonly #connection: JsforceConnection;

  constructor(connection: JsforceConnection) {
    this.#connection = connection;
  }

  async executeQuery<O>(
    compiledQuery: CompiledQuery<O>,
  ): Promise<readonly O[]> {
    const records: Record<string, unknown>[] = [];
    let result = await this.#connection.query(compiledQuery.soql);

    records.push(...result.records);

    while (!result.done) {
      if (!result.nextRecordsUrl) {
        throw new Error(
          "JSforce returned an incomplete query result without nextRecordsUrl.",
        );
      }

      result = await this.#connection.queryMore(result.nextRecordsUrl);
      records.push(...result.records);
    }

    return records as unknown as readonly O[];
  }
}

export const createJsforceExecutor = (
  connection: JsforceConnection,
): JsforceExecutor => new JsforceQueryExecutor(connection);
