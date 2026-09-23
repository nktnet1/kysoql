import assert from "node:assert/strict";

export const origin = "https://example.my.salesforce.com";

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

export const tokenResponse = (
  overrides: Record<string, unknown> = {},
): Response =>
  Response.json({
    access_token: "access",
    instance_url: origin,
    token_type: "Bearer",
    ...overrides,
  });
