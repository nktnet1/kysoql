import {
  applyQueryResultAliases,
  type CompiledQuery,
  type QueryExecutor,
  type RelationshipSubqueryNode,
  type SelectQueryNode,
} from "@kysoql/core";

import {
  type RestClient,
  type RestClientOptions,
  resolveRestClient,
} from "#/client";
import { SalesforceQueryLimitError, SalesforceResponseError } from "#/errors";
import type { RestRequestOptions } from "#/http";
import {
  type ParsedQueryPage,
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
}

export interface RestPaginationOptions {
  /** Requested batch size (200-2000), not a guaranteed page size. */
  readonly batchSize?: number;
  /** Query-page budget across root and relationship continuations. Default: 10,000. */
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
}

interface QueryPlan {
  readonly limit?: number;
  readonly children: ReadonlyMap<string, QueryPlan>;
}

interface PaginationState {
  readonly visited: Set<string>;
  pages: number;
}

const queryPath = (query: CompiledQuery<unknown>, queryAll: boolean): string =>
  `/${queryAll ? "queryAll" : "query"}?${new URLSearchParams({ q: query.soql })}`;

const literalLimit = (
  query: SelectQueryNode | RelationshipSubqueryNode,
): number | undefined => {
  const limit = query.limit?.limit;
  return typeof limit === "number" ? limit : undefined;
};

const queryPlan = (
  query: SelectQueryNode | RelationshipSubqueryNode,
): QueryPlan => {
  const children = new Map<string, QueryPlan>();
  for (const selection of query.selections ?? []) {
    if (selection.selection.kind === "RelationshipSubqueryNode") {
      children.set(
        selection.selection.relationship.name,
        queryPlan(selection.selection),
      );
    }
  }
  const limit = literalLimit(query);
  return limit === undefined ? { children } : { children, limit };
};

const completedPage = (
  totalSize: number,
  records: readonly Record<string, unknown>[],
): ParsedQueryPage => ({
  done: true,
  totalSize,
  records,
});

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

  #validatedPage(page: ParsedQueryPage): ParsedQueryPage {
    if (page.nextRecordsUrl !== undefined) {
      parseQueryLocator(page.nextRecordsUrl, this.#client.apiVersion);
    }
    return page;
  }

  async #page(
    path: string,
    options: RestRequestOptions,
  ): Promise<ParsedQueryPage> {
    return this.#validatedPage(
      parseQueryPage(
        await this.#client.request(path, {
          ...options,
          ...(this.#batchSize === undefined
            ? {}
            : { batchSize: this.#batchSize }),
        }),
      ),
    );
  }

  async #nextPage(
    path: string,
    options: RestRequestOptions,
    state: PaginationState,
  ): Promise<ParsedQueryPage> {
    options.signal?.throwIfAborted();
    if (state.pages >= this.#maxPages) {
      throw new SalesforceQueryLimitError("maxPages");
    }
    if (state.visited.has(path)) {
      throw new SalesforceResponseError(
        "Salesforce returned a repeated query locator.",
      );
    }
    state.visited.add(path);
    const page = await this.#page(path, options);
    state.pages++;
    if (
      !page.done &&
      page.nextRecordsUrl !== undefined &&
      state.visited.has(page.nextRecordsUrl)
    ) {
      throw new SalesforceResponseError(
        "Salesforce returned a repeated query locator.",
      );
    }
    return page;
  }

  async #hydrateRecords(
    records: readonly Record<string, unknown>[],
    plan: QueryPlan,
    options: RestRequestOptions,
    state: PaginationState,
  ): Promise<readonly Record<string, unknown>[]> {
    if (plan.children.size === 0 || records.length === 0) {
      return records;
    }

    const hydrated: Record<string, unknown>[] = [];
    for (const record of records) {
      options.signal?.throwIfAborted();
      let output: Record<string, unknown> | undefined;
      for (const [relationship, childPlan] of plan.children) {
        const child = record[relationship];
        if (child === undefined) {
          throw new SalesforceResponseError(
            `Missing selected relationship query result: ${relationship}.`,
          );
        }
        const result = await this.#drainRelationship(
          this.#validatedPage(parseQueryPage(child)),
          childPlan,
          options,
          state,
        );
        output ??= { ...record };
        output[relationship] = result;
      }
      hydrated.push(output ?? record);
    }
    return hydrated;
  }

  async #drainRelationship(
    initial: ParsedQueryPage,
    plan: QueryPlan,
    options: RestRequestOptions,
    state: PaginationState,
  ): Promise<ParsedQueryPage> {
    const records: Record<string, unknown>[] = [];
    let remaining = plan.limit;
    let page = initial;

    while (true) {
      options.signal?.throwIfAborted();
      const selected =
        remaining === undefined
          ? page.records
          : page.records.slice(0, remaining);
      records.push(
        ...(await this.#hydrateRecords(selected, plan, options, state)),
      );
      if (remaining !== undefined) {
        remaining -= selected.length;
      }

      if (page.done || remaining === 0) {
        return completedPage(initial.totalSize, records);
      }
      if (page.nextRecordsUrl === undefined) {
        throw new SalesforceResponseError("Missing Salesforce query locator.");
      }
      page = await this.#nextPage(page.nextRecordsUrl, options, state);
    }
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

    const plan = queryPlan(query.query);
    const state: PaginationState = { visited: new Set<string>(), pages: 0 };
    let path = queryPath(query, options.queryAll ?? false);
    let remaining = plan.limit;
    let records = 0;

    while (true) {
      const page = await this.#nextPage(path, options, state);
      const selected =
        remaining === undefined
          ? page.records
          : page.records.slice(0, remaining);
      if (records + selected.length > this.#maxRecords) {
        throw new SalesforceQueryLimitError("maxRecords");
      }
      const hydrated = await this.#hydrateRecords(
        selected,
        plan,
        options,
        state,
      );
      records += hydrated.length;
      if (remaining !== undefined) {
        remaining -= hydrated.length;
      }
      const done = page.done || remaining === 0;
      yield {
        done,
        totalSize: page.totalSize,
        records: applyQueryResultAliases<O>(query.query, hydrated),
      };
      if (done) {
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
}

export const createRestExecutor = (
  client: RestClient | RestClientOptions,
  options: RestPaginationOptions = {},
): RestExecutor => new NativeRestExecutor(resolveRestClient(client), options);
