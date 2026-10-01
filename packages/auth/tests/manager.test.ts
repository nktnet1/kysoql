import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  createMemoryRefreshTokenStore,
  createStoredRefreshTokenAuth,
} from "#/index";
import { mockFetch, origin, tokenResponse } from "./helpers.js";

describe("stored refresh-token auth", () => {
  it("loads, rotates, and reuses a stored refresh token", async () => {
    const store = createMemoryRefreshTokenStore("first");
    const http = mockFetch(
      tokenResponse({ access_token: "one", refresh_token: "second" }),
      tokenResponse({ access_token: "two" }),
    );
    const auth = createStoredRefreshTokenAuth({
      loginUrl: origin,
      clientId: "consumer",
      clientSecret: "secret",
      refreshTokenStore: store,
      fetch: http.fetch,
    });
    assert.equal((await auth.getSession()).accessToken, "one");
    assert.equal(await store.getRefreshToken(), "second");
    assert.equal(await auth.accessTokenProvider({ refresh: false }), "one");
    assert.equal(await auth.accessTokenProvider({ refresh: true }), "two");
    assert.equal(
      new URLSearchParams(String(http.calls[1]?.init.body)).get(
        "refresh_token",
      ),
      "second",
    );
    assert.equal(http.calls.length, 2);
  });

  it("single-flights concurrent refreshes", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const http = mockFetch(async () => {
      await gate;
      return tokenResponse();
    });
    const auth = createStoredRefreshTokenAuth({
      loginUrl: origin,
      clientId: "consumer",
      refreshTokenStore: createMemoryRefreshTokenStore("refresh"),
      fetch: http.fetch,
    });
    const first = auth.refresh();
    const second = auth.refresh();
    release();
    const [left, right] = await Promise.all([first, second]);
    assert.equal(left.accessToken, right.accessToken);
    assert.equal(http.calls.length, 1);
  });

  it("persists an initial token after a successful non-rotating refresh", async () => {
    const store = createMemoryRefreshTokenStore();
    const http = mockFetch(tokenResponse());
    const auth = createStoredRefreshTokenAuth({
      loginUrl: origin,
      clientId: "consumer",
      initialRefreshToken: "initial",
      refreshTokenStore: store,
      fetch: http.fetch,
    });
    await auth.getSession();
    assert.equal(await store.getRefreshToken(), "initial");
  });

  it("can use hybrid refresh and HTTP Basic client authentication", async () => {
    const http = mockFetch(tokenResponse());
    const auth = createStoredRefreshTokenAuth({
      loginUrl: origin,
      clientId: "consumer",
      clientSecret: "secret",
      clientSecretTransport: "basic",
      refreshMode: "hybrid",
      refreshTokenStore: createMemoryRefreshTokenStore("refresh"),
      fetch: http.fetch,
    });
    await auth.refresh();
    const body = new URLSearchParams(String(http.calls[0]?.init.body));
    assert.equal(body.get("grant_type"), "hybrid_refresh");
    assert.equal(body.has("client_secret"), false);
    assert.equal(
      new Headers(http.calls[0]?.init.headers).get("Authorization"),
      `Basic ${Buffer.from("consumer:secret").toString("base64")}`,
    );
  });

  it("rejects an invalid refresh mode at runtime", () => {
    assert.throws(
      () =>
        createStoredRefreshTokenAuth({
          loginUrl: origin,
          clientId: "consumer",
          refreshMode: "legacy" as never,
          refreshTokenStore: createMemoryRefreshTokenStore("refresh"),
        }),
      /refreshMode/,
    );
  });

  it("refuses an instance change across refreshes", async () => {
    const http = mockFetch(
      tokenResponse(),
      tokenResponse({ instance_url: "https://other.my.salesforce.com" }),
    );
    const auth = createStoredRefreshTokenAuth({
      loginUrl: origin,
      clientId: "consumer",
      refreshTokenStore: createMemoryRefreshTokenStore("refresh"),
      fetch: http.fetch,
    });
    await auth.getSession();
    await assert.rejects(auth.refresh(), /instance changed/);
  });

  it("clears both cached session and persistent token", async () => {
    const store = createMemoryRefreshTokenStore("refresh");
    const http = mockFetch(tokenResponse());
    const auth = createStoredRefreshTokenAuth({
      loginUrl: origin,
      clientId: "consumer",
      refreshTokenStore: store,
      fetch: http.fetch,
    });
    await auth.getSession();
    await auth.clear();
    assert.equal(await store.getRefreshToken(), undefined);
    await assert.rejects(auth.getSession(), /No refresh token/);
  });
});
