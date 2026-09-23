import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, it } from "vitest";

import {
  createJwtBearerAssertion,
  createOAuthClientAssertion,
  createPkceChallenge,
  generatePkcePair,
} from "#/index";

const decodeBase64Url = (value: string): string => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
};

const createPrivateKeyPem = async (): Promise<string> => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const encoded = Buffer.from(pkcs8).toString("base64");
  const lines = encoded.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
};

describe("PKCE and JWT helpers", () => {
  it("matches the RFC 7636 S256 example", async () => {
    assert.equal(
      await createPkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("generates a valid PKCE verifier/challenge pair", async () => {
    const pair = await generatePkcePair();
    assert.match(pair.verifier, /^[A-Za-z0-9._~-]{43,128}$/);
    assert.equal(pair.challenge, await createPkceChallenge(pair.verifier));
  });

  it("creates an RS256 Salesforce JWT bearer assertion", async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      false,
      ["sign", "verify"],
    );
    const jwt = await createJwtBearerAssertion({
      clientId: "consumer",
      username: "integration@example.com",
      loginUrl: "https://login.salesforce.com",
      privateKey: keyPair.privateKey,
      expiresInSeconds: 180,
      now: 1_800_000_000,
    });
    const [headerPart, payloadPart, signaturePart] = jwt.split(".");
    assert.ok(headerPart && payloadPart && signaturePart);
    assert.deepEqual(JSON.parse(decodeBase64Url(headerPart)), {
      alg: "RS256",
      typ: "JWT",
    });
    assert.deepEqual(JSON.parse(decodeBase64Url(payloadPart)), {
      iss: "consumer",
      sub: "integration@example.com",
      aud: "https://login.salesforce.com",
      exp: 1_800_000_180,
    });
    assert.equal(
      await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        keyPair.publicKey,
        Buffer.from(
          signaturePart.replaceAll("-", "+").replaceAll("_", "/"),
          "base64",
        ),
        new TextEncoder().encode(`${headerPart}.${payloadPart}`),
      ),
      true,
    );
  });

  it("accepts and trims a PEM private-key value", async () => {
    const jwt = await createJwtBearerAssertion({
      clientId: "consumer",
      username: "integration@example.com",
      loginUrl: "https://login.salesforce.com",
      privateKey: `\n  ${await createPrivateKeyPem()}  \n`,
      now: 1_800_000_000,
    });

    assert.equal(jwt.split(".").length, 3);
  });

  it("loads a PEM private key from a file path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kysoql-auth-key-"));
    const filename = join(directory, "salesforce-auth-key.pem");
    try {
      await writeFile(filename, `${await createPrivateKeyPem()}\n`, "utf8");
      const jwt = await createJwtBearerAssertion({
        clientId: "consumer",
        username: "integration@example.com",
        loginUrl: "https://login.salesforce.com",
        privateKey: filename,
        now: 1_800_000_000,
      });

      assert.equal(jwt.split(".").length, 3);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("loads a PEM private key from a file URL", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kysoql-auth-key-"));
    const filename = join(directory, "salesforce-auth-key.pem");
    try {
      await writeFile(filename, await createPrivateKeyPem(), "utf8");
      const jwt = await createJwtBearerAssertion({
        clientId: "consumer",
        username: "integration@example.com",
        loginUrl: "https://login.salesforce.com",
        privateKey: pathToFileURL(filename),
        now: 1_800_000_000,
      });

      assert.equal(jwt.split(".").length, 3);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a blank private-key value before reading a file", async () => {
    await assert.rejects(
      createJwtBearerAssertion({
        clientId: "consumer",
        username: "integration@example.com",
        loginUrl: "https://login.salesforce.com",
        privateKey: "   ",
        now: 1_800_000_000,
      }),
      /privateKey must not be empty/,
    );
  });

  it("creates an RS256 private_key_jwt client assertion", async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      false,
      ["sign", "verify"],
    );
    const jwt = await createOAuthClientAssertion({
      clientId: "consumer",
      loginUrl: "https://example.my.salesforce.com",
      privateKey: keyPair.privateKey,
      now: 1_800_000_000,
    });
    const [, payloadPart] = jwt.split(".");
    assert.ok(payloadPart);
    assert.deepEqual(JSON.parse(decodeBase64Url(payloadPart)), {
      iss: "consumer",
      sub: "consumer",
      aud: "https://example.my.salesforce.com/services/oauth2/token",
      exp: 1_800_000_180,
    });
  });

  it("targets an Experience Cloud site token endpoint in a client assertion", async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      false,
      ["sign", "verify"],
    );
    const jwt = await createOAuthClientAssertion({
      clientId: "consumer",
      loginUrl: "https://customers.example.my.site.com/portal/",
      privateKey: keyPair.privateKey,
      now: 1_800_000_000,
    });
    const [, payloadPart] = jwt.split(".");
    assert.ok(payloadPart);
    assert.equal(
      JSON.parse(decodeBase64Url(payloadPart)).aud,
      "https://customers.example.my.site.com/portal/services/oauth2/token",
    );
  });
});
