import {
  type AbortableQueryOptions,
  applyQueryResultAliases,
  type CompiledQuery,
  type QueryExecutor,
} from "@kysoql/core";
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
  query(
    soql: string,
    options?: { readonly scanAll?: boolean },
  ): PromiseLike<unknown>;
  queryMore(locator: string): PromiseLike<unknown>;
}

export interface JsforceExecutor extends QueryExecutor {
  executeAllQuery<O>(
    compiledQuery: CompiledQuery<O>,
    options?: AbortableQueryOptions,
  ): Promise<readonly O[]>;
  executeAllCountQuery(
    compiledQuery: CompiledQuery<number>,
    options?: AbortableQueryOptions,
  ): Promise<number>;
  executeCountQuery(
    compiledQuery: CompiledQuery<number>,
    options?: AbortableQueryOptions,
  ): Promise<number>;
}

const waitForQuery = async <T>(
  value: PromiseLike<T>,
  signal?: AbortSignal,
): Promise<T> => {
  signal?.throwIfAborted();
  const promise = Promise.resolve(value);

  if (!signal) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const aborted = (): void => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", aborted));

    if (signal.aborted) {
      aborted();
    }
  });
};

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
    options: AbortableQueryOptions = {},
  ): Promise<readonly O[]> {
    return this.#executePagedQuery(compiledQuery, false, options);
  }

  async executeAllQuery<O>(
    compiledQuery: CompiledQuery<O>,
    options: AbortableQueryOptions = {},
  ): Promise<readonly O[]> {
    return this.#executePagedQuery(compiledQuery, true, options);
  }

  async #executePagedQuery<O>(
    compiledQuery: CompiledQuery<O>,
    scanAll: boolean,
    options: AbortableQueryOptions,
  ): Promise<readonly O[]> {
    const records: Record<string, unknown>[] = [];
    let result = parseJsforceQueryResult(
      await waitForQuery(
        scanAll
          ? this.#connection.query(compiledQuery.soql, { scanAll: true })
          : this.#connection.query(compiledQuery.soql),
        options.signal,
      ),
    );

    records.push(...result.records);

    while (!result.done) {
      if (!result.nextRecordsUrl) {
        throw new Error(
          "JSforce returned an incomplete query result without nextRecordsUrl.",
        );
      }

      result = parseJsforceQueryResult(
        await waitForQuery(
          this.#connection.queryMore(result.nextRecordsUrl),
          options.signal,
        ),
      );
      records.push(...result.records);
    }

    return applyQueryResultAliases<O>(compiledQuery.query, records);
  }

  async executeCountQuery(
    compiledQuery: CompiledQuery<number>,
    options: AbortableQueryOptions = {},
  ): Promise<number> {
    return this.#executeCountQuery(compiledQuery, false, options);
  }

  async executeAllCountQuery(
    compiledQuery: CompiledQuery<number>,
    options: AbortableQueryOptions = {},
  ): Promise<number> {
    return this.#executeCountQuery(compiledQuery, true, options);
  }

  async #executeCountQuery(
    compiledQuery: CompiledQuery<number>,
    scanAll: boolean,
    options: AbortableQueryOptions,
  ): Promise<number> {
    const result = parseJsforceCountQueryResult(
      await waitForQuery(
        scanAll
          ? this.#connection.query(compiledQuery.soql, { scanAll: true })
          : this.#connection.query(compiledQuery.soql),
        options.signal,
      ),
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
