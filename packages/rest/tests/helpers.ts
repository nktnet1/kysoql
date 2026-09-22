import assert from "node:assert/strict";
import type { CompiledQuery } from "@kysoql/core";

export const origin = "https://example.my.salesforce.com";
export const locator = "/services/data/v65.0/query/01gEXAMPLE-2000";

export const compiled = <O = { readonly Id: string }>(
  soql = "SELECT Id FROM Account",
): CompiledQuery<O> => ({
  soql,
  query: {
    kind: "SelectQueryNode",
    from: { kind: "SObjectNode", name: "Account" },
  },
});

export const page = (records: readonly unknown[] = [], next?: string) => ({
  totalSize: records.length,
  done: next === undefined,
  records,
  ...(next === undefined ? {} : { nextRecordsUrl: next }),
});

export interface FetchCall {
  readonly url: URL;
  readonly init: RequestInit;
}

export type FetchReply =
  | Response
  | ((call: FetchCall) => Response | Promise<Response>);

export const mockFetch = (...replies: readonly FetchReply[]) => {
  const calls: FetchCall[] = [];
  const fetch: typeof globalThis.fetch = async (input, init = {}) => {
    const call = {
      url: new URL(input instanceof Request ? input.url : String(input)),
      init,
    };
    const reply = replies[calls.length];
    calls.push(call);
    assert.ok(reply !== undefined, "Unexpected HTTP request");
    return typeof reply === "function" ? reply(call) : reply;
  };
  return { calls, fetch };
};

export const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
