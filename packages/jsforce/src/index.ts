import type { CompiledQuery, QueryExecutor } from "@kysoql/core";
import * as v from "valibot";

const jsforceQueryResultSchema = v.object({
  done: v.boolean(),
  nextRecordsUrl: v.optional(v.string()),
  records: v.array(v.record(v.string(), v.unknown())),
});

const jsforceCountQueryResultSchema = v.object({
  done: v.boolean(),
  records: v.optional(v.nullable(v.array(v.record(v.string(), v.unknown())))),
  totalSize: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
});

export interface JsforceQueryResult {
  readonly done: boolean;
  readonly nextRecordsUrl?: string;
  readonly records: readonly Record<string, unknown>[];
}

export interface JsforceCountQueryResult {
  readonly done: boolean;
  readonly records?: readonly Record<string, unknown>[] | null;
  readonly totalSize: number;
}

export interface JsforceConnection {
  query(soql: string): PromiseLike<unknown>;
  queryMore(locator: string): PromiseLike<unknown>;
}

export interface JsforceExecutor extends QueryExecutor {
  executeCountQuery(compiledQuery: CompiledQuery<number>): Promise<number>;
}

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

const parseJsforceCountQueryResult = (
  input: unknown,
): JsforceCountQueryResult => {
  const result = v.safeParse(jsforceCountQueryResultSchema, input);

  if (!result.success) {
    throw new TypeError(
      `Invalid JSforce COUNT() query result:\n${v.summarize(result.issues)}`,
    );
  }

  const { done, records, totalSize } = result.output;
  return records === undefined
    ? { done, totalSize }
    : { done, records, totalSize };
};

class JsforceQueryExecutor implements JsforceExecutor {
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

  async executeCountQuery(
    compiledQuery: CompiledQuery<number>,
  ): Promise<number> {
    const result = parseJsforceCountQueryResult(
      await this.#connection.query(compiledQuery.soql),
    );

    if (!result.done) {
      throw new Error(
        "JSforce returned an incomplete SOQL COUNT() query result.",
      );
    }

    return result.totalSize;
  }
}

export const createJsforceExecutor = (
  connection: JsforceConnection,
): JsforceExecutor => new JsforceQueryExecutor(connection);
