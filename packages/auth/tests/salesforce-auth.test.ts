import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { SalesforceAuth } from "#/index";
import { mockFetch, origin, tokenResponse } from "./helpers.js";

const form = (init: RequestInit | undefined): URLSearchParams =>
  new URLSearchParams(String(init?.body));

const createPrivateKey = async (): Promise<CryptoKey> => {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"],
  );
  return pair.privateKey;
};

describe("SalesforceAuth", () => {
  it("binds login URL and client ID for authorization URLs", () => {
    const auth = new SalesforceAuth({ loginUrl: origin, clientId: "consumer" });
    const url = new URL(
      auth.authorizationUrl({
        redirectUri: "https://app.example.com/callback",
        scope: ["api", "refresh_token"],
      }),
    );

    assert.equal(url.origin, origin);
    assert.equal(url.searchParams.get("client_id"), "consumer");
    assert.equal(url.searchParams.get("scope"), "api refresh_token");
  });

  it("combines JWT assertion creation and exchange", async () => {
    const http = mockFetch(tokenResponse());
    const auth = new SalesforceAuth({
      loginUrl: origin,
      clientId: "consumer",
      fetch: http.fetch,
    });

    const session = await auth.jwtBearer({
      username: "integration@example.com",
      privateKey: { type: "crypto-key", key: await createPrivateKey() },
      now: 1_800_000_000,
    });

    assert.equal(session.accessToken, "access");
    const body = form(http.calls[0]?.init);
    assert.equal(
      body.get("grant_type"),
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    );
    const assertion = body.get("assertion");
    assert.ok(assertion);
    const [, payload] = assertion.split(".");
    assert.ok(payload);
    const normalized = payload.replaceAll("-", "+").replaceAll("_", "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = JSON.parse(
      Buffer.from(`${normalized}${padding}`, "base64").toString("utf8"),
    ) as Record<string, unknown>;
    assert.equal(decoded.iss, "consumer");
    assert.equal(decoded.sub, "integration@example.com");
    assert.equal(decoded.aud, origin);
  });

  it("binds Experience Cloud site paths for headless requests", () => {
    const siteUrl = "https://customers.example.my.site.com/customers";
    const auth = new SalesforceAuth({
      loginUrl: siteUrl,
      clientId: "consumer",
    });
    const request = auth.codeCredentialsAuthorization({
      redirectUri: "https://app.example.com/callback",
      username: "user@example.com",
      password: "secret",
    });

    assert.equal(request.url, `${siteUrl}/services/oauth2/authorize`);
    assert.equal(
      new URLSearchParams(String(request.init.body)).get("client_id"),
      "consumer",
    );
  });
});
