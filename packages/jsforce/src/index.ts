import {
  type AbortableQueryOptions,
  applyQueryResultAliases,
  type CompiledQuery,
  type QueryAbortSignal,
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

/**
 * Minimal JSforce paginated query result shape consumed by the executor.
 */
export interface JsforceQueryResult {
  /** Whether JSforce has returned the final query page. */
  readonly done: boolean;
  /** Query locator URL used for `queryMore()` when additional pages remain. */
  readonly nextRecordsUrl?: string;
  /** Records returned in this JSforce page. */
  readonly records: readonly Record<string, unknown>[];
}

/** Minimal JSforce COUNT() result shape consumed by the executor. */
export interface JsforceCountQueryResult {
  /** Whether the `COUNT()` response is complete. */
  readonly done: boolean;
  /** Optional records payload returned by JSforce; ignored for count extraction. */
  readonly records?: readonly Record<string, unknown>[] | null;
  /** Count reported by JSforce for the query. */
  readonly totalSize: number;
}

/** Subset of a JSforce connection required by Kysoql query execution. */
export interface JsforceConnection {
  /** Runs SOQL through JSforce; `scanAll` enables Salesforce query-all semantics. */
  query(
    soql: string,
    options?: {
      /** Use JSforce query-all semantics, including deleted and archived records. */
      readonly scanAll?: boolean;
    },
  ): PromiseLike<unknown>;
  /** Loads the next JSforce page using a query locator. */
  queryMore(locator: string): PromiseLike<unknown>;
}

/**
 * Query executor backed by a JSforce connection, including queryAll support.
 */
export interface JsforceExecutor extends QueryExecutor {
  /** Executes using JSforce `scanAll` semantics and follows all pages. */
  executeAllQuery<O>(
    compiledQuery: CompiledQuery<O>,
    options?: AbortableQueryOptions,
  ): Promise<readonly O[]>;
  /** Executes `COUNT()` using JSforce `scanAll` semantics. */
  executeAllCountQuery(
    compiledQuery: CompiledQuery<number>,
    options?: AbortableQueryOptions,
  ): Promise<number>;
  /** Executes a normal JSforce `COUNT()` query. */
  executeCountQuery(
    compiledQuery: CompiledQuery<number>,
    options?: AbortableQueryOptions,
  ): Promise<number>;
}

const waitForQuery = async <T>(
  start: () => PromiseLike<T>,
  signal?: QueryAbortSignal,
): Promise<T> => {
  signal?.throwIfAborted();
  const promise = Promise.resolve(start());

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
        () =>
          scanAll
            ? this.#connection.query(compiledQuery.soql, { scanAll: true })
            : this.#connection.query(compiledQuery.soql),
        options.signal,
      ),
    );

    records.push(...result.records);

    while (!result.done) {
      const locator = result.nextRecordsUrl;

      if (!locator) {
        throw new Error(
          "JSforce returned an incomplete query result without nextRecordsUrl.",
        );
      }

      result = parseJsforceQueryResult(
        await waitForQuery(
          () => this.#connection.queryMore(locator),
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
        () =>
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

/** Creates a Kysoql executor around an existing JSforce connection. */
export const createJsforceExecutor = (
  connection: JsforceConnection,
): JsforceExecutor => new JsforceQueryExecutor(connection);
