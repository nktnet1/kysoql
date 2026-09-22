import type { CompiledQuery, QueryExecutor } from "@kysoql/core";

import {
  type RestClient,
  type RestClientOptions,
  resolveRestClient,
} from "#/client";
import { SalesforceQueryLimitError, SalesforceResponseError } from "#/errors";
import type { RestRequestOptions } from "#/http";
import {
  parseBatchSize,
  parseCount,
  parseQueryLocator,
  parseQueryPage,
  positiveInteger,
} from "#/validation";

export interface RestQueryPage<O> {
  readonly done: boolean;
  readonly totalSize: number;
  readonly records: readonly O[];
  readonly nextRecordsUrl?: string;
}

export interface RestPaginationOptions {
  /** Requested batch size (200-2000), not a guaranteed page size. */
  readonly batchSize?: number;
  /** Root page budget, including the first page. Default: 10,000. */
  readonly maxPages?: number;
  /** Optional root-record budget. Exceeding it throws, never silently truncates. */
  readonly maxRecords?: number;
}

export interface RestQueryOptions extends RestRequestOptions {
  /** QueryAll includes qualifying deleted records; it is not a pagination switch. */
  readonly queryAll?: boolean;
}

export interface RestExecutor extends QueryExecutor {
  executeQuery<O>(
    query: CompiledQuery<O>,
    options?: RestRequestOptions,
  ): Promise<readonly O[]>;
  executeAllQuery<O>(
    query: CompiledQuery<O>,
    options?: RestRequestOptions,
  ): Promise<readonly O[]>;
  executeCountQuery(
    query: CompiledQuery<number>,
    options?: RestRequestOptions,
  ): Promise<number>;
  executeAllCountQuery(
    query: CompiledQuery<number>,
    options?: RestRequestOptions,
  ): Promise<number>;
  queryPages<O>(
    query: CompiledQuery<O>,
    options?: RestQueryOptions,
  ): AsyncIterableIterator<RestQueryPage<O>>;
  iterateQuery<O>(
    query: CompiledQuery<O>,
    options?: RestQueryOptions,
  ): AsyncIterableIterator<O>;
  /** Fetch one continuation page, including a child query envelope's locator. */
  queryMore<O = Record<string, unknown>>(
    locator: string,
    options?: RestRequestOptions,
  ): Promise<RestQueryPage<O>>;
}

const queryPath = (query: CompiledQuery<unknown>, queryAll: boolean): string =>
  `/${queryAll ? "queryAll" : "query"}?${new URLSearchParams({ q: query.soql })}`;

class NativeRestExecutor implements RestExecutor {
  readonly #client: RestClient;
  readonly #batchSize: number | undefined;
  readonly #maxPages: number;
  readonly #maxRecords: number;

  constructor(client: RestClient, options: RestPaginationOptions) {
    this.#client = client;
    this.#batchSize = parseBatchSize(options.batchSize);
    this.#maxPages = positiveInteger(options.maxPages ?? 10_000, "maxPages");
    this.#maxRecords =
      options.maxRecords === undefined
        ? Number.MAX_SAFE_INTEGER
        : positiveInteger(options.maxRecords, "maxRecords");
  }

  async #page<O>(
    path: string,
    options: RestRequestOptions,
  ): Promise<RestQueryPage<O>> {
    const page = parseQueryPage(
      await this.#client.request(path, {
        ...options,
        ...(this.#batchSize === undefined
          ? {}
          : { batchSize: this.#batchSize }),
      }),
    );
    if (!page.done && page.nextRecordsUrl !== undefined) {
      parseQueryLocator(page.nextRecordsUrl, this.#client.apiVersion);
    }
    // O is a compile-time projection, not a runtime schema. Preserve nested
    // records/attributes verbatim; only the root query envelope is validated.
    return page as unknown as RestQueryPage<O>;
  }

  async *queryPages<O>(
    query: CompiledQuery<O>,
    options: RestQueryOptions = {},
  ): AsyncIterableIterator<RestQueryPage<O>> {
    const selections = query.query.selections;
    const selection =
      selections?.length === 1 ? selections[0]?.selection : undefined;
    if (
      selection?.kind === "AggregateFunctionNode" &&
      selection.function === "count" &&
      selection.reference === undefined
    ) {
      throw new TypeError(
        "Use executeCountQuery or executeAllCountQuery for bare COUNT().",
      );
    }
    let path = queryPath(query, options.queryAll ?? false);
    const visited = new Set<string>();
    let pages = 0;
    let records = 0;
    while (true) {
      options.signal?.throwIfAborted();
      if (pages >= this.#maxPages) {
        throw new SalesforceQueryLimitError("maxPages");
      }
      if (visited.has(path)) {
        throw new SalesforceResponseError(
          "Salesforce returned a repeated query locator.",
        );
      }
      visited.add(path);
      const page = await this.#page<O>(path, options);
      pages++;
      records += page.records.length;
      if (records > this.#maxRecords) {
        throw new SalesforceQueryLimitError("maxRecords");
      }
      if (
        page.nextRecordsUrl !== undefined &&
        !page.done &&
        visited.has(page.nextRecordsUrl)
      ) {
        throw new SalesforceResponseError(
          "Salesforce returned a repeated query locator.",
        );
      }
      yield page;
      if (page.done) {
        return;
      }
      if (page.nextRecordsUrl === undefined) {
        throw new SalesforceResponseError("Missing Salesforce query locator.");
      }
      path = page.nextRecordsUrl;
    }
  }

  async *iterateQuery<O>(
    query: CompiledQuery<O>,
    options: RestQueryOptions = {},
  ): AsyncIterableIterator<O> {
    for await (const page of this.queryPages(query, options)) {
      for (const record of page.records) {
        options.signal?.throwIfAborted();
        yield record;
      }
    }
  }

  async #collect<O>(
    query: CompiledQuery<O>,
    options: RestQueryOptions,
  ): Promise<readonly O[]> {
    const records: O[] = [];
    for await (const record of this.iterateQuery(query, options)) {
      records.push(record);
    }
    return records;
  }

  executeQuery<O>(
    query: CompiledQuery<O>,
    options: RestRequestOptions = {},
  ): Promise<readonly O[]> {
    return this.#collect(query, { ...options, queryAll: false });
  }

  executeAllQuery<O>(
    query: CompiledQuery<O>,
    options: RestRequestOptions = {},
  ): Promise<readonly O[]> {
    return this.#collect(query, { ...options, queryAll: true });
  }

  async executeCountQuery(
    query: CompiledQuery<number>,
    options: RestRequestOptions = {},
  ): Promise<number> {
    return parseCount(
      await this.#client.request(queryPath(query, false), options),
    );
  }

  async executeAllCountQuery(
    query: CompiledQuery<number>,
    options: RestRequestOptions = {},
  ): Promise<number> {
    return parseCount(
      await this.#client.request(queryPath(query, true), options),
    );
  }

  async queryMore<O = Record<string, unknown>>(
    locator: string,
    options: RestRequestOptions = {},
  ): Promise<RestQueryPage<O>> {
    return this.#page(
      parseQueryLocator(locator, this.#client.apiVersion),
      options,
    );
  }
}

export const createRestExecutor = (
  client: RestClient | RestClientOptions,
  options: RestPaginationOptions = {},
): RestExecutor => new NativeRestExecutor(resolveRestClient(client), options);
