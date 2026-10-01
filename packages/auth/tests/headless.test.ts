import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  createCodeCredentialsAuthorizationRequest,
  createHeadlessGuestAuthorizationRequest,
  requestFirstPartyAuthorizationChallenge,
} from "#src/index";
import { mockFetch } from "./helpers.js";

const siteUrl = "https://customers.example.my.site.com";

describe("headless authorization", () => {
  it("preserves an Experience Cloud site path", async () => {
    const nestedSiteUrl = `${siteUrl}/customers`;
    const request = createCodeCredentialsAuthorizationRequest({
      siteUrl: `${nestedSiteUrl}/`,
      clientId: "consumer",
      redirectUri: "https://app.example.com/callback",
      username: "user@example.com",
      password: "secret",
    });
    assert.equal(request.url, `${nestedSiteUrl}/services/oauth2/authorize`);

    const http = mockFetch(Response.json({ authorization_code: "code" }));
    await requestFirstPartyAuthorizationChallenge({
      siteUrl: nestedSiteUrl,
      parameters: { client_assertion: "attestation" },
      fetch: http.fetch,
    });
    assert.equal(
      http.calls[0]?.url.href,
      `${nestedSiteUrl}/services/oauth2/v1/authorization_challenge`,
    );
  });

  it("builds a code-and-credentials POST with Basic credentials", () => {
    const request = createCodeCredentialsAuthorizationRequest({
      siteUrl,
      clientId: "consumer",
      redirectUri: "https://app.example.com/callback",
      username: "user@example.com",
      password: "p:a ss",
      codeChallenge: "challenge",
    });
    assert.equal(request.url, `${siteUrl}/services/oauth2/authorize`);
    assert.equal(request.init.method, "POST");
    assert.equal(request.init.redirect, "manual");
    assert.equal(
      new Headers(request.init.headers).get("Auth-Request-Type"),
      "Named-User",
    );
    assert.equal(
      new Headers(request.init.headers).get("Authorization"),
      `Basic ${Buffer.from("user@example.com:p:a ss").toString("base64")}`,
    );
    const body = new URLSearchParams(String(request.init.body));
    assert.equal(body.get("response_type"), "code_credentials");
    assert.equal(body.get("code_challenge"), "challenge");
    assert.equal(body.has("password"), false);
  });

  it("can place code-and-credentials credentials in the POST body", () => {
    const request = createCodeCredentialsAuthorizationRequest({
      siteUrl,
      clientId: "consumer",
      redirectUri: "https://app.example.com/callback",
      username: "user@example.com",
      password: "secret",
      credentialsPlacement: "body",
    });
    assert.equal(new Headers(request.init.headers).has("Authorization"), false);
    const body = new URLSearchParams(String(request.init.body));
    assert.equal(body.get("username"), "user@example.com");
    assert.equal(body.get("password"), "secret");
  });

  it("supports Code and Credentials headless user discovery", () => {
    const request = createCodeCredentialsAuthorizationRequest({
      siteUrl,
      clientId: "consumer",
      redirectUri: "https://app.example.com/callback",
      loginHint: "order-123",
      password: "secret",
      customData: JSON.stringify({ locale: "en-AU" }),
      uvidHintToken: "jwt-with-uvid",
    });
    const headers = new Headers(request.init.headers);
    assert.equal(headers.has("Authorization"), false);
    assert.equal(headers.get("Uvid-Hint"), "jwt-with-uvid");
    const body = new URLSearchParams(String(request.init.body));
    assert.equal(body.get("login_hint"), "order-123");
    assert.equal(body.get("password"), "secret");
    assert.equal(body.get("customdata"), '{"locale":"en-AU"}');
    assert.equal(body.has("username"), false);
  });

  it("builds a guest authorization request with Salesforce UVID prefixes", () => {
    const headerRequest = createHeadlessGuestAuthorizationRequest({
      siteUrl: `${siteUrl}/customers`,
      clientId: "consumer",
      redirectUri: "https://app.example.com/callback",
      uvidHint: "abcd-1234",
      scope: ["openid", "api"],
    });
    const headerHeaders = new Headers(headerRequest.init.headers);
    assert.equal(headerHeaders.get("Auth-Request-Type"), "guest");
    assert.equal(headerHeaders.get("Uvid-Hint"), "UVID abcd-1234");
    assert.equal(
      headerRequest.url,
      `${siteUrl}/customers/services/oauth2/authorize`,
    );
    const headerBody = new URLSearchParams(String(headerRequest.init.body));
    assert.equal(headerBody.get("scope"), "openid api");
    assert.equal(headerBody.has("uvid_hint"), false);

    const bodyRequest = createHeadlessGuestAuthorizationRequest({
      siteUrl,
      clientId: "consumer",
      redirectUri: "https://app.example.com/callback",
      uvidHintToken: "guest-jwt",
      uvidPlacement: "body",
    });
    assert.equal(new Headers(bodyRequest.init.headers).has("Uvid-Hint"), false);
    assert.equal(
      new URLSearchParams(String(bodyRequest.init.body)).get("uvid_hint"),
      "JWT guest-jwt",
    );
  });

  it("requires exactly one UVID source for guest authorization", () => {
    assert.throws(
      () =>
        createHeadlessGuestAuthorizationRequest({
          siteUrl,
          clientId: "consumer",
          redirectUri: "https://app.example.com/callback",
        } as never),
      /exactly one/,
    );
    assert.throws(
      () =>
        createHeadlessGuestAuthorizationRequest({
          siteUrl,
          clientId: "consumer",
          redirectUri: "https://app.example.com/callback",
          uvidHint: "plain",
          uvidHintToken: "jwt",
        } as never),
      /exactly one/,
    );
  });

  it("returns a first-party authorization code", async () => {
    const http = mockFetch(Response.json({ authorization_code: "code" }));
    assert.deepEqual(
      await requestFirstPartyAuthorizationChallenge({
        siteUrl,
        parameters: {
          username: "user@example.com",
          password: "secret",
          client_id: "consumer",
          client_assertion: "attestation",
          code_challenge: "challenge",
        },
        fetch: http.fetch,
      }),
      { kind: "authorized", authorizationCode: "code" },
    );
    assert.equal(
      http.calls[0]?.url.href,
      `${siteUrl}/services/oauth2/v1/authorization_challenge`,
    );
  });

  it("returns a resumable first-party challenge without leaking server text", async () => {
    const http = mockFetch(
      Response.json(
        {
          error: "authorization_required",
          error_code: "invalid_credentials",
          auth_session: "session",
        },
        { status: 403 },
      ),
    );
    assert.deepEqual(
      await requestFirstPartyAuthorizationChallenge({
        siteUrl,
        parameters: { password: "secret", auth_session: "session" },
        fetch: http.fetch,
      }),
      {
        kind: "challenge",
        status: 403,
        error: "authorization_required",
        errorCode: "invalid_credentials",
        authSession: "session",
        response: {
          error: "authorization_required",
          error_code: "invalid_credentials",
          auth_session: "session",
        },
      },
    );
  });

  it("rejects invalid headless request modes at runtime", async () => {
    assert.throws(
      () =>
        createCodeCredentialsAuthorizationRequest({
          siteUrl,
          clientId: "consumer",
          redirectUri: "https://app.example.com/callback",
          username: "user@example.com",
          password: "secret",
          credentialsPlacement: "query" as never,
        }),
      /credentialsPlacement/,
    );
    assert.throws(
      () =>
        createCodeCredentialsAuthorizationRequest({
          siteUrl,
          clientId: "consumer",
          redirectUri: "https://app.example.com/callback",
          loginHint: "order-123",
          password: "secret",
          credentialsPlacement: "authorization-header" as never,
        }),
      /user discovery/,
    );
    assert.throws(
      () =>
        createCodeCredentialsAuthorizationRequest({
          siteUrl,
          clientId: "consumer",
          redirectUri: "https://app.example.com/callback",
          username: "user@example.com",
          password: "secret",
          uvidHint: "plain-uvid",
          uvidHintToken: "jwt-uvid",
        }),
      /not both/,
    );

    const http = mockFetch();
    await assert.rejects(
      requestFirstPartyAuthorizationChallenge({
        siteUrl,
        bodyFormat: "xml" as never,
        parameters: {},
        fetch: http.fetch,
      }),
      /bodyFormat/,
    );
    assert.equal(http.calls.length, 0);
  });

  it("supports JSON request bodies for first-party registration", async () => {
    const http = mockFetch(
      Response.json(
        {
          error: "authorization_required",
          error_code: "login_initialized",
          auth_session: "session",
          login_status: { state: "otp_sent", type: "EMAIL" },
        },
        { status: 403 },
      ),
    );
    const result = await requestFirstPartyAuthorizationChallenge({
      siteUrl,
      bodyFormat: "json",
      parameters: {
        userdata: {
          username: "user@example.com",
          lastName: "Example",
          email: "user@example.com",
        },
        password: "secret",
        client_assertion: "attestation",
      },
      fetch: http.fetch,
    });
    assert.equal(
      new Headers(http.calls[0]?.init.headers).get("Content-Type"),
      "application/json",
    );
    assert.deepEqual(JSON.parse(String(http.calls[0]?.init.body)), {
      userdata: {
        username: "user@example.com",
        lastName: "Example",
        email: "user@example.com",
      },
      password: "secret",
      client_assertion: "attestation",
    });
    assert.equal(result.kind, "challenge");
    if (result.kind === "challenge") {
      assert.deepEqual(result.response.login_status, {
        state: "otp_sent",
        type: "EMAIL",
      });
    }
  });

  it("sends a first-party Uvid-Hint token without inventing a scheme", async () => {
    const http = mockFetch(Response.json({ authorization_code: "code" }));
    await requestFirstPartyAuthorizationChallenge({
      siteUrl,
      parameters: { client_assertion: "attestation" },
      uvidHintToken: "jwt-with-uvid",
      fetch: http.fetch,
    });
    assert.equal(
      new Headers(http.calls[0]?.init.headers).get("Uvid-Hint"),
      "jwt-with-uvid",
    );
  });
});
