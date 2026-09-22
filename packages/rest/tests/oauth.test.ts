import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  authenticateClientCredentials,
  refreshAccessToken,
  SalesforceOAuthError,
  SalesforceResponseError,
} from "#/index";
import { mockFetch, origin } from "./helpers.js";

const token = {
  access_token: "access",
  instance_url: origin,
  token_type: "Bearer",
};
const credentials = {
  loginUrl: origin,
  clientId: "consumer",
  clientSecret: "s&+=ecret",
};

describe("native OAuth token exchanges", () => {
  it("exchanges client credentials with a form body, never URL credentials", async () => {
    const http = mockFetch(Response.json(token));
    assert.deepEqual(
      await authenticateClientCredentials({
        ...credentials,
        fetch: http.fetch,
      }),
      { accessToken: "access", instanceUrl: origin },
    );
    const call = http.calls[0];
    assert.ok(call);
    assert.equal(call.url.href, `${origin}/services/oauth2/token`);
    assert.equal(call.init.method, "POST");
    assert.equal(call.init.redirect, "error");
    assert.equal(call.init.cache, "no-store");
    assert.equal(
      new Headers(call.init.headers).get("Content-Type"),
      "application/x-www-form-urlencoded",
    );
    assert.equal(typeof call.init.body, "string");
    const body = new URLSearchParams(String(call.init.body));
    assert.equal(body.get("grant_type"), "client_credentials");
    assert.equal(body.get("client_id"), "consumer");
    assert.equal(body.get("client_secret"), "s&+=ecret");
  });

  it("refreshes a token and returns a rotated refresh token", async () => {
    const http = mockFetch(
      Response.json({ ...token, refresh_token: "rotated" }),
    );
    assert.deepEqual(
      await refreshAccessToken({
        ...credentials,
        refreshToken: "original+&",
        fetch: http.fetch,
      }),
      {
        accessToken: "access",
        instanceUrl: origin,
        refreshToken: "rotated",
      },
    );
    const body = new URLSearchParams(String(http.calls[0]?.init.body));
    assert.equal(body.get("grant_type"), "refresh_token");
    assert.equal(body.get("refresh_token"), "original+&");
    assert.equal(body.get("client_secret"), "s&+=ecret");
  });

  it("omits a refresh secret when the application policy does not require it", async () => {
    const http = mockFetch(Response.json(token));
    await refreshAccessToken({
      loginUrl: origin,
      clientId: "consumer",
      refreshToken: "refresh",
      fetch: http.fetch,
    });
    assert.equal(
      new URLSearchParams(String(http.calls[0]?.init.body)).has(
        "client_secret",
      ),
      false,
    );
  });

  it("reports OAuth error codes without echoing secrets or server descriptions", async () => {
    const http = mockFetch(
      Response.json(
        { error: "invalid_grant", error_description: "sensitive identity" },
        { status: 400 },
      ),
    );
    await assert.rejects(
      authenticateClientCredentials({ ...credentials, fetch: http.fetch }),
      (error: unknown) => {
        assert.ok(error instanceof SalesforceOAuthError);
        assert.equal(error.status, 400);
        assert.equal(error.code, "invalid_grant");
        assert.equal(
          error.message,
          "Salesforce OAuth request failed (HTTP 400).",
        );
        return true;
      },
    );
    assert.equal(http.calls.length, 1);
  });

  for (const body of [
    null,
    {},
    { ...token, access_token: 42 },
    { ...token, instance_url: null },
    { ...token, token_type: "Basic" },
    { ...token, refresh_token: 7 },
  ]) {
    it(`rejects an invalid OAuth response ${JSON.stringify(body)}`, async () => {
      const http = mockFetch(Response.json(body));
      await assert.rejects(
        authenticateClientCredentials({ ...credentials, fetch: http.fetch }),
        SalesforceResponseError,
      );
    });
  }

  it("refuses insecure login origins before transmitting secrets", async () => {
    const http = mockFetch();
    await assert.rejects(
      authenticateClientCredentials({
        ...credentials,
        loginUrl: "http://insecure.invalid",
        fetch: http.fetch,
      }),
      /HTTPS origin/,
    );
    assert.equal(http.calls.length, 0);
  });

  it("refuses an insecure instance returned by OAuth", async () => {
    const http = mockFetch(
      Response.json({ ...token, instance_url: "http://insecure.invalid" }),
    );
    await assert.rejects(
      authenticateClientCredentials({ ...credentials, fetch: http.fetch }),
      /HTTPS origin/,
    );
  });

  it("honours cancellation before a token exchange", async () => {
    const controller = new AbortController();
    controller.abort();
    const http = mockFetch();
    await assert.rejects(
      authenticateClientCredentials({
        ...credentials,
        fetch: http.fetch,
        signal: controller.signal,
      }),
      { name: "AbortError" },
    );
    assert.equal(http.calls.length, 0);
  });
});
