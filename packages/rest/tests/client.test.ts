import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { describe, it } from "vitest";

import {
  createRestClient,
  SalesforceResponseError,
  SalesforceRestError,
} from "#/index";
import { deferred, mockFetch, origin, page } from "./helpers.js";

const expired = () =>
  Response.json(
    [{ errorCode: "INVALID_SESSION_ID", message: "Session expired" }],
    { status: 401 },
  );

const options = { instanceUrl: origin, accessToken: "token" };

describe("native REST transport", () => {
  it("pins the API version, preserves URL encoding, and protects the bearer header", async () => {
    const http = mockFetch(Response.json({ ok: true }));
    const client = createRestClient({ ...options, fetch: http.fetch });
    assert.equal(client.apiVersion, "65.0");
    assert.deepEqual(
      await client.request("/query?q=a%2Bb%26c", { batchSize: 500 }),
      { ok: true },
    );
    const call = http.calls[0];
    assert.ok(call);
    assert.equal(call.url.origin, origin);
    assert.equal(call.url.pathname, "/services/data/v65.0/query");
    assert.equal(call.url.searchParams.get("q"), "a+b&c");
    const headers = new Headers(call.init.headers);
    assert.equal(headers.get("Authorization"), "Bearer token");
    assert.equal(headers.get("Accept"), "application/json");
    assert.equal(headers.get("Sforce-Query-Options"), "batchSize=500");
    assert.equal(call.init.method, "GET");
    assert.equal(call.init.redirect, "error");
    assert.equal(call.init.cache, "no-store");
    assert.ok(call.init.signal instanceof AbortSignal);
  });

  it("respects an explicit version without discovering or upgrading it", async () => {
    const http = mockFetch(Response.json({}));
    await createRestClient({
      ...options,
      apiVersion: "67.0",
      fetch: http.fetch,
    }).request("/sobjects/");
    assert.equal(http.calls[0]?.url.pathname, "/services/data/v67.0/sobjects/");
    assert.equal(http.calls.length, 1);
  });

  for (const instanceUrl of [
    "http://example.com",
    "not-a-url",
    `${origin}/services`,
    `${origin}?token=x`,
    "https://user:pass@example.com",
    `${origin}#fragment`,
  ]) {
    it(`rejects an unsafe instance URL: ${instanceUrl}`, () => {
      assert.throws(
        () => createRestClient({ ...options, instanceUrl }),
        TypeError,
      );
    });
  }

  for (const apiVersion of ["v65.0", "65", "65.1", "", "../query", " 65.0"]) {
    it(`rejects invalid apiVersion ${JSON.stringify(apiVersion)}`, () => {
      assert.throws(
        () => createRestClient({ ...options, apiVersion }),
        /apiVersion/,
      );
    });
  }

  for (const path of [
    "https://evil.invalid/query",
    "//evil.invalid/query",
    "/../oauth2/token",
    "/services/data/v64.0/query/x",
    "/query#fragment",
    "/query\\x",
    "/%252e%252e/%252e%252e",
  ]) {
    it(`rejects an unsafe API path before HTTP: ${path}`, async () => {
      const http = mockFetch();
      await assert.rejects(
        createRestClient({ ...options, fetch: http.fetch }).request(path),
        TypeError,
      );
      assert.equal(http.calls.length, 0);
    });
  }

  for (const accessToken of ["", " ", "secret\r\nHeader: injected"]) {
    it("rejects invalid tokens without echoing their contents", () => {
      assert.throws(
        () => createRestClient({ ...options, accessToken }),
        (error: unknown) => {
          assert.ok(error instanceof TypeError);
          assert.ok(!error.message.includes("secret"));
          return true;
        },
      );
    });
  }

  for (const batchSize of [0, 199, 2001, 300.5, Number.NaN]) {
    it(`rejects batchSize ${batchSize}`, async () => {
      const http = mockFetch();
      await assert.rejects(
        createRestClient({ ...options, fetch: http.fetch }).request("/query", {
          batchSize,
        }),
        /batchSize/,
      );
      assert.equal(http.calls.length, 0);
    });
  }

  for (const timeoutMs of [
    0,
    -1,
    0.5,
    Number.POSITIVE_INFINITY,
    2_147_483_648,
  ]) {
    it(`rejects timeoutMs ${timeoutMs}`, () => {
      assert.throws(
        () => createRestClient({ ...options, timeoutMs }),
        /timeoutMs/,
      );
    });
  }

  it("retains structured errors but does not log SOQL, secrets, or response messages", async () => {
    const details = [
      {
        errorCode: "INVALID_FIELD",
        message: "SensitiveField for secret-person",
        fields: ["SensitiveField"],
      },
    ];
    const http = mockFetch(Response.json(details, { status: 400 }));
    await assert.rejects(
      createRestClient({ ...options, fetch: http.fetch }).request(
        "/query?q=secret-soql",
      ),
      (error: unknown) => {
        assert.ok(error instanceof SalesforceRestError);
        assert.equal(error.status, 400);
        assert.deepEqual(error.errors, details);
        assert.equal(
          error.message,
          "Salesforce REST request failed (HTTP 400).",
        );
        return true;
      },
    );
  });

  it("reports HTML/proxy failures as HTTP errors, not JSON syntax errors", async () => {
    const http = mockFetch(
      new Response("<html>sensitive proxy output</html>", { status: 503 }),
    );
    await assert.rejects(
      createRestClient({ ...options, fetch: http.fetch }).request("/query"),
      (error: unknown) => {
        assert.ok(error instanceof SalesforceRestError);
        assert.equal(error.status, 503);
        assert.deepEqual(error.errors, []);
        return true;
      },
    );
  });

  it("rejects invalid successful JSON", async () => {
    const http = mockFetch(new Response("not JSON"));
    await assert.rejects(
      createRestClient({ ...options, fetch: http.fetch }).request("/query"),
      SalesforceResponseError,
    );
  });

  it("preserves network errors and does not retry them", async () => {
    const error = new TypeError("network disconnected");
    const http = mockFetch(() => {
      throw error;
    });
    await assert.rejects(
      createRestClient({ ...options, fetch: http.fetch }).request("/query"),
      (cause) => cause === error,
    );
    assert.equal(http.calls.length, 1);
  });

  for (const status of [401, 403, 429, 500, 503]) {
    it(`does not retry HTTP ${status} with a static token`, async () => {
      const http = mockFetch(
        Response.json(
          [{ errorCode: "REQUEST_LIMIT_EXCEEDED", message: "no" }],
          { status },
        ),
      );
      await assert.rejects(
        createRestClient({ ...options, fetch: http.fetch }).request("/query"),
        SalesforceRestError,
      );
      assert.equal(http.calls.length, 1);
    });
  }

  it("acquires and refreshes a provider token once across concurrent requests", async () => {
    const refresh = deferred<string>();
    const refreshStarted = deferred<void>();
    const flags: boolean[] = [];
    const headers: string[] = [];
    const fetch: typeof globalThis.fetch = async (_input, init) => {
      const token = new Headers(init?.headers).get("Authorization") ?? "";
      headers.push(token);
      return token === "Bearer initial" ? expired() : Response.json(page());
    };
    const client = createRestClient({
      instanceUrl: origin,
      fetch,
      accessToken: ({ refresh: forced }) => {
        flags.push(forced);
        if (!forced) {
          return "initial";
        }
        refreshStarted.resolve();
        return refresh.promise;
      },
    });
    const requests = Promise.all([
      client.request("/query"),
      client.request("/query"),
    ]);
    await refreshStarted.promise;
    refresh.resolve("renewed");
    await requests;
    assert.deepEqual(flags, [false, true]);
    assert.equal(
      headers.filter((header) => header === "Bearer initial").length,
      2,
    );
    assert.equal(
      headers.filter((header) => header === "Bearer renewed").length,
      2,
    );
    await client.request("/query");
    assert.deepEqual(flags, [false, true]);
  });

  it("limits an invalid-session retry to one attempt", async () => {
    const http = mockFetch(expired(), expired());
    const flags: boolean[] = [];
    const client = createRestClient({
      instanceUrl: origin,
      fetch: http.fetch,
      accessToken: ({ refresh }) => {
        flags.push(refresh);
        return "still-invalid";
      },
    });
    await assert.rejects(client.request("/query"), SalesforceRestError);
    assert.equal(http.calls.length, 2);
    assert.deepEqual(flags, [false, true]);
  });

  it("does not refresh a provider for unrelated authentication or permission errors", async () => {
    const http = mockFetch(
      Response.json([{ errorCode: "INSUFFICIENT_ACCESS", message: "no" }], {
        status: 401,
      }),
    );
    let calls = 0;
    const client = createRestClient({
      instanceUrl: origin,
      fetch: http.fetch,
      accessToken: () => {
        calls++;
        return "token";
      },
    });
    await assert.rejects(client.request("/query"), SalesforceRestError);
    assert.equal(calls, 1);
  });

  it("does not cache a failed initial token acquisition", async () => {
    const http = mockFetch(Response.json({}));
    let calls = 0;
    const error = new Error("provider failed");
    const client = createRestClient({
      instanceUrl: origin,
      fetch: http.fetch,
      accessToken: async () => {
        if (++calls === 1) {
          throw error;
        }
        return "token";
      },
    });
    await assert.rejects(client.request("/query"), (cause) => cause === error);
    assert.deepEqual(await client.request("/query"), {});
    assert.equal(calls, 2);
  });

  it("rejects an empty provider result before making a request", async () => {
    const http = mockFetch();
    const client = createRestClient({
      instanceUrl: origin,
      fetch: http.fetch,
      accessToken: () => "",
    });
    await assert.rejects(client.request("/query"), /provider result/);
    assert.equal(http.calls.length, 0);
  });

  it("honours an already-aborted signal without fetching or calling the token provider", async () => {
    const controller = new AbortController();
    const reason = new Error("cancelled");
    controller.abort(reason);
    const http = mockFetch();
    const client = createRestClient({
      instanceUrl: origin,
      fetch: http.fetch,
      accessToken: () => {
        assert.fail("provider called");
      },
    });
    await assert.rejects(
      client.request("/query", { signal: controller.signal }),
      (cause) => cause === reason,
    );
    assert.equal(http.calls.length, 0);
  });

  it("combines client and per-request cancellation", async () => {
    const controller = new AbortController();
    const reason = new Error("client stopped");
    controller.abort(reason);
    const client = createRestClient({
      ...options,
      signal: controller.signal,
      fetch: mockFetch().fetch,
    });
    await assert.rejects(
      client.request("/query", { signal: new AbortController().signal }),
      (cause) => cause === reason,
    );
  });

  it("times out a pending HTTP request", async () => {
    const http = mockFetch(
      ({ init }) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        }),
    );
    // AbortSignal.timeout uses unreferenced timers; keep this test's event loop alive.
    const keepAlive = setTimeout(() => {}, 1000);
    try {
      await assert.rejects(
        createRestClient({
          ...options,
          fetch: http.fetch,
          timeoutMs: 5,
        }).request("/query"),
        { name: "TimeoutError" },
      );
    } finally {
      clearTimeout(keepAlive);
    }
  });

  it("cancels one waiter without cancelling shared token acquisition", async () => {
    const token = deferred<string>();
    const started = deferred<void>();
    const http = mockFetch(Response.json({}));
    const client = createRestClient({
      instanceUrl: origin,
      fetch: http.fetch,
      accessToken: () => {
        started.resolve();
        return token.promise;
      },
    });
    const controller = new AbortController();
    const reason = new Error("caller cancelled");
    const cancelled = assert.rejects(
      client.request("/query", { signal: controller.signal }),
      (cause) => cause === reason,
    );
    await started.promise;
    const other = client.request("/query");
    controller.abort(reason);
    await cancelled;
    token.resolve("token");
    await other;
    assert.equal(http.calls.length, 1);
  });

  it("times out token acquisition without making an eventual late HTTP request", async () => {
    const token = deferred<string>();
    const http = mockFetch();
    const client = createRestClient({
      instanceUrl: origin,
      fetch: http.fetch,
      accessToken: () => token.promise,
    });
    const keepAlive = setTimeout(() => {}, 1000);
    try {
      await assert.rejects(client.request("/query", { timeoutMs: 5 }), {
        name: "TimeoutError",
      });
      token.resolve("late-token");
      await delay(0);
      assert.equal(http.calls.length, 0);
    } finally {
      clearTimeout(keepAlive);
    }
  });
});
