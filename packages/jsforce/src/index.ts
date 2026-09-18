import type { CompiledQuery, QueryExecutor } from "@kysoql/core";
import * as v from "valibot";

const jsforceQueryResultSchema = v.object({
  done: v.boolean(),
  nextRecordsUrl: v.optional(v.string()),
  records: v.array(v.record(v.string(), v.unknown())),
});

export interface JsforceQueryResult {
  readonly done: boolean;
  readonly nextRecordsUrl?: string;
  readonly records: readonly Record<string, unknown>[];
}

export interface JsforceConnection {
  query(soql: string): PromiseLike<unknown>;
  queryMore(locator: string): PromiseLike<unknown>;
}

export type JsforceExecutor = QueryExecutor;

const parseJsforceQueryResult = (input: unknown): JsforceQueryResult => {
  const result = v.safeParse(jsforceQueryResultSchema, input);

  if (!result.success) {
    throw new TypeError(
      `Invalid JSforce query result:\n${v.summarize(result.issues)}`,
    );
  }

  const { done, nextRecordsUrl, records } = result.output;

  return nextRecordsUrl === undefined
    ? { done, records }
    : { done, nextRecordsUrl, records };
};

class JsforceQueryExecutor implements QueryExecutor {
  readonly #connection: JsforceConnection;

  constructor(connection: JsforceConnection) {
    this.#connection = connection;
  }

  async executeQuery<O>(
    compiledQuery: CompiledQuery<O>,
  ): Promise<readonly O[]> {
    const records: Record<string, unknown>[] = [];
    let result = parseJsforceQueryResult(
      await this.#connection.query(compiledQuery.soql),
    );

    records.push(...result.records);

    while (!result.done) {
      if (!result.nextRecordsUrl) {
        throw new Error(
          "JSforce returned an incomplete query result without nextRecordsUrl.",
        );
      }

      result = parseJsforceQueryResult(
        await this.#connection.queryMore(result.nextRecordsUrl),
      );
      records.push(...result.records);
    }

    return records as unknown as readonly O[];
  }
}

export const createJsforceExecutor = (
  connection: JsforceConnection,
): JsforceExecutor => new JsforceQueryExecutor(connection);
