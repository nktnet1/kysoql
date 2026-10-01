import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  authenticateClientCredentials,
  authenticateJwtBearer,
  authenticateSamlAssertion,
  authenticateSamlBearer,
  createAuthorizationUrl,
  exchangeAuthorizationCode,
  exchangeHybridAuthorizationCode,
  exchangeToken,
  pollDeviceAuthorization,
  refreshAccessToken,
  refreshHybridAccessToken,
  requestDeviceAuthorization,
  SalesforceOAuthError,
  SalesforceOAuthResponseError,
} from "#/index";
import { mockFetch, origin, tokenResponse } from "./helpers.js";

const form = (init: RequestInit | undefined): URLSearchParams =>
  new URLSearchParams(String(init?.body));

const base = { loginUrl: origin, clientId: "consumer" };

describe("OAuth token grants", () => {
  it("builds an authorization-code URL with PKCE", () => {
    const url = new URL(
      createAuthorizationUrl({
        ...base,
        redirectUri: "https://app.example.com/callback",
        scope: ["api", "refresh_token"],
        state: "state-value",
        codeChallenge: "challenge",
      }),
    );
    assert.equal(url.origin, origin);
    assert.equal(url.pathname, "/services/oauth2/authorize");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("client_id"), "consumer");
    assert.equal(url.searchParams.get("scope"), "api refresh_token");
    assert.equal(url.searchParams.get("state"), "state-value");
    assert.equal(url.searchParams.get("code_challenge"), "challenge");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  });

  it("preserves an Experience Cloud site path for OAuth endpoints", async () => {
    const siteUrl = "https://customers.example.my.site.com/portal";
    const authorize = new URL(
      createAuthorizationUrl({
        loginUrl: siteUrl,
        clientId: "consumer",
        redirectUri: "https://app.example.com/callback",
      }),
    );
    assert.equal(
      authorize.href.split("?")[0],
      `${siteUrl}/services/oauth2/authorize`,
    );

    const http = mockFetch(tokenResponse());
    await exchangeAuthorizationCode({
      loginUrl: `${siteUrl}/`,
      clientId: "consumer",
      code: "code",
      redirectUri: "https://app.example.com/callback",
      fetch: http.fetch,
    });
    assert.equal(http.calls[0]?.url.href, `${siteUrl}/services/oauth2/token`);
  });

  it("exchanges an authorization code with PKCE and a client assertion", async () => {
    const http = mockFetch(tokenResponse({ refresh_token: "refresh" }));
    const session = await exchangeAuthorizationCode({
      ...base,
      code: "code",
      redirectUri: "https://app.example.com/callback",
      codeVerifier: "verifier",
      clientAssertion: "assertion",
      fetch: http.fetch,
    });
    assert.equal(session.refreshToken, "refresh");
    const body = form(http.calls[0]?.init);
    assert.equal(body.get("grant_type"), "authorization_code");
    assert.equal(body.get("code_verifier"), "verifier");
    assert.equal(body.get("client_assertion"), "assertion");
    assert.equal(
      body.get("client_assertion_type"),
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    );
  });

  it("supports HTTP Basic client authentication without body credentials", async () => {
    const http = mockFetch(tokenResponse());
    await exchangeAuthorizationCode({
      ...base,
      code: "code",
      redirectUri: "https://app.example.com/callback",
      clientSecret: "secret",
      clientSecretTransport: "basic",
      fetch: http.fetch,
    });
    const body = form(http.calls[0]?.init);
    assert.equal(body.has("client_id"), false);
    assert.equal(body.has("client_secret"), false);
    assert.equal(
      new Headers(http.calls[0]?.init.headers).get("Authorization"),
      `Basic ${Buffer.from("consumer:secret").toString("base64")}`,
    );
  });

  it("supports Headless Identity headers during code exchange", async () => {
    const http = mockFetch(tokenResponse());
    await exchangeAuthorizationCode({
      loginUrl: "https://customers.example.my.site.com/portal",
      clientId: "consumer",
      code: "code",
      redirectUri: "https://app.example.com/callback",
      codeVerifier: "verifier",
      authRequestType: "guest",
      uvidHint: "visitor-or-token",
      fetch: http.fetch,
    });
    const headers = new Headers(http.calls[0]?.init.headers);
    assert.equal(headers.get("Auth-Request-Type"), "guest");
    assert.equal(headers.get("Uvid-Hint"), "visitor-or-token");
  });

  it("uses the hybrid grants", async () => {
    const http = mockFetch(tokenResponse(), tokenResponse());
    await exchangeHybridAuthorizationCode({
      ...base,
      code: "code",
      redirectUri: "https://app.example.com/callback",
      fetch: http.fetch,
    });
    await refreshHybridAccessToken({
      ...base,
      refreshToken: "refresh",
      fetch: http.fetch,
    });
    assert.equal(
      form(http.calls[0]?.init).get("grant_type"),
      "hybrid_auth_code",
    );
    assert.equal(form(http.calls[1]?.init).get("grant_type"), "hybrid_refresh");
  });

  it("exchanges current non-interactive assertion grants", async () => {
    const http = mockFetch(tokenResponse(), tokenResponse(), tokenResponse());
    await authenticateJwtBearer({
      ...base,
      assertion: "jwt",
      fetch: http.fetch,
    });
    await authenticateSamlBearer({
      ...base,
      assertion: "saml",
      fetch: http.fetch,
    });
    await authenticateSamlAssertion({
      ...base,
      assertion: "saml",
      fetch: http.fetch,
    });
    assert.deepEqual(
      http.calls.map((call) => form(call.init).get("grant_type")),
      [
        "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "urn:ietf:params:oauth:grant-type:saml2-bearer",
        "assertion",
      ],
    );
    assert.equal(
      form(http.calls[2]?.init).get("assertion_type"),
      "urn:oasis:names:tc:SAML:2.0:profiles:SSO:browser",
    );
  });

  it("exchanges a supported subject token", async () => {
    const http = mockFetch(tokenResponse());
    await exchangeToken({
      ...base,
      subjectToken: "subject",
      subjectTokenType: "urn:ietf:params:oauth:token-type:jwt",
      scope: ["api", "refresh_token"],
      tokenHandler: "handler",
      clientSecret: "secret",
      fetch: http.fetch,
    });
    const body = form(http.calls[0]?.init);
    assert.equal(
      body.get("grant_type"),
      "urn:ietf:params:oauth:grant-type:token-exchange",
    );
    assert.equal(
      body.get("subject_token_type"),
      "urn:ietf:params:oauth:token-type:jwt",
    );
    assert.equal(body.get("scope"), "api refresh_token");
    assert.equal(body.get("token_handler"), "handler");
  });

  it("rejects an unsupported token-exchange subject type at runtime", async () => {
    const http = mockFetch();
    await assert.rejects(
      exchangeToken({
        ...base,
        subjectToken: "subject",
        subjectTokenType: "urn:example:unsupported" as never,
        fetch: http.fetch,
      }),
      /subjectTokenType/,
    );
    assert.equal(http.calls.length, 0);
  });

  it("requests and polls device authorization", async () => {
    const http = mockFetch(
      Response.json({
        device_code: "device",
        user_code: "ABCD-EFGH",
        verification_uri: "https://login.salesforce.com/setup/connect",
        interval: 5,
        expires_in: 600,
      }),
      tokenResponse(),
    );
    const device = await requestDeviceAuthorization({
      ...base,
      scope: "api refresh_token",
      redirectUri: "http://127.0.0.1:1717/callback",
      fetch: http.fetch,
    });
    assert.deepEqual(device, {
      deviceCode: "device",
      userCode: "ABCD-EFGH",
      verificationUri: "https://login.salesforce.com/setup/connect",
      intervalSeconds: 5,
      expiresInSeconds: 600,
    });
    assert.equal(form(http.calls[0]?.init).get("response_type"), "device_code");
    await pollDeviceAuthorization({
      ...base,
      deviceCode: device.deviceCode,
      fetch: http.fetch,
    });
    assert.equal(form(http.calls[1]?.init).get("grant_type"), "device");
    assert.equal(form(http.calls[1]?.init).get("code"), "device");
  });

  it("persists rotated refresh tokens before returning", async () => {
    const written: string[] = [];
    const http = mockFetch(tokenResponse({ refresh_token: "rotated" }));
    const session = await refreshAccessToken({
      ...base,
      refreshToken: "old",
      refreshTokenStore: {
        getRefreshToken: async () => undefined,
        setRefreshToken: async (token) => {
          written.push(token);
        },
        deleteRefreshToken: async () => undefined,
      },
      fetch: http.fetch,
    });
    assert.equal(session.refreshToken, "rotated");
    assert.deepEqual(written, ["rotated"]);
  });

  it("supports client credentials only on a My Domain", async () => {
    const http = mockFetch(tokenResponse());
    await authenticateClientCredentials({
      ...base,
      clientSecret: "secret",
      fetch: http.fetch,
    });
    const body = form(http.calls[0]?.init);
    assert.equal(body.get("grant_type"), "client_credentials");
    await assert.rejects(
      authenticateClientCredentials({
        loginUrl: "https://login.salesforce.com",
        clientId: "consumer",
        clientSecret: "secret",
        fetch: http.fetch,
      }),
      /My Domain/,
    );
    assert.equal(http.calls.length, 1);
  });

  it("supports HTTP Basic for client credentials", async () => {
    const http = mockFetch(tokenResponse());
    await authenticateClientCredentials({
      ...base,
      clientSecret: "secret",
      clientSecretTransport: "basic",
      fetch: http.fetch,
    });
    const body = form(http.calls[0]?.init);
    assert.deepEqual([...body], [["grant_type", "client_credentials"]]);
    assert.equal(
      new Headers(http.calls[0]?.init.headers).get("Authorization"),
      `Basic ${Buffer.from("consumer:secret").toString("base64")}`,
    );
  });

  it("rejects mutually exclusive client authentication", async () => {
    const http = mockFetch();
    await assert.rejects(
      refreshAccessToken({
        ...base,
        refreshToken: "refresh",
        clientSecret: "secret",
        clientAssertion: "assertion",
        fetch: http.fetch,
      }),
      /not both/,
    );
    assert.equal(http.calls.length, 0);
  });

  it("rejects invalid client-secret transport at runtime", async () => {
    const http = mockFetch();
    await assert.rejects(
      refreshAccessToken({
        ...base,
        refreshToken: "refresh",
        clientSecret: "secret",
        clientSecretTransport: "query" as never,
        fetch: http.fetch,
      }),
      /clientSecretTransport/,
    );
    assert.equal(http.calls.length, 0);
  });

  it("reports OAuth errors without server descriptions", async () => {
    const http = mockFetch(
      Response.json(
        { error: "invalid_grant", error_description: "sensitive identity" },
        { status: 400 },
      ),
    );
    await assert.rejects(
      authenticateJwtBearer({ ...base, assertion: "jwt", fetch: http.fetch }),
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
  });

  it("rejects malformed successful token and device responses", async () => {
    const tokenHttp = mockFetch(Response.json({ access_token: "access" }));
    await assert.rejects(
      authenticateJwtBearer({
        ...base,
        assertion: "jwt",
        fetch: tokenHttp.fetch,
      }),
      SalesforceOAuthResponseError,
    );
    const deviceHttp = mockFetch(
      Response.json({
        device_code: "device",
        user_code: "code",
        verification_uri: "http://insecure.invalid",
        interval: 5,
      }),
    );
    await assert.rejects(
      requestDeviceAuthorization({ ...base, fetch: deviceHttp.fetch }),
      SalesforceOAuthResponseError,
    );
  });
});
