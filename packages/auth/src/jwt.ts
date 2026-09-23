import { encodeBase64Url } from "#/pkce";
import { nonEmptySecret, parseOAuthBaseUrl, parseOrigin } from "#/validation";

const textBase64Url = (value: string): string =>
  encodeBase64Url(new TextEncoder().encode(value));

export type PrivateKeyInput = CryptoKey | string | URL;

export interface JwtBearerAssertionOptions {
  readonly clientId: string;
  readonly username: string;
  /** Salesforce login/My Domain origin used as the JWT audience. */
  readonly loginUrl: string;
  /**
   * RS256 signing key. Pass a CryptoKey, PEM value, or PEM file path/file URL.
   * String values are trimmed; strings without a PEM header are treated as paths.
   */
  readonly privateKey: PrivateKeyInput;
  /** Default: 180 seconds. Maximum: 300 seconds. */
  readonly expiresInSeconds?: number;
  /**
   * Unix timestamp in seconds. Defaults to the current time. Useful for
   * deterministic tests.
   */
  readonly now?: number;
}

export interface OAuthClientAssertionOptions {
  readonly clientId: string;
  /**
   * Salesforce login/My Domain or Experience Cloud base URL whose token endpoint
   * receives the assertion.
   */
  readonly loginUrl: string;
  /**
   * RS256 signing key. Pass a CryptoKey, PEM value, or PEM file path/file URL.
   * String values are trimmed; strings without a PEM header are treated as paths.
   */
  readonly privateKey: PrivateKeyInput;
  /** Default: 180 seconds. Maximum: 300 seconds. */
  readonly expiresInSeconds?: number;
  /**
   * Unix timestamp in seconds. Defaults to the current time. Useful for
   * deterministic tests.
   */
  readonly now?: number;
}

const assertionTiming = (
  options: Pick<JwtBearerAssertionOptions, "expiresInSeconds" | "now">,
): { readonly expiresInSeconds: number; readonly now: number } => {
  const expiresInSeconds = options.expiresInSeconds ?? 180;
  if (
    !Number.isSafeInteger(expiresInSeconds) ||
    expiresInSeconds <= 0 ||
    expiresInSeconds > 300
  ) {
    throw new TypeError(
      "expiresInSeconds must be an integer between 1 and 300.",
    );
  }
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(now) || now <= 0) {
    throw new TypeError("now must be a positive Unix timestamp in seconds.");
  }
  return { expiresInSeconds, now };
};

const validatePrivateKey = (privateKey: CryptoKey): void => {
  if (
    privateKey.type !== "private" ||
    privateKey.algorithm.name !== "RSASSA-PKCS1-v1_5"
  ) {
    throw new TypeError(
      "privateKey must be an RSASSA-PKCS1-v1_5 private CryptoKey.",
    );
  }
};

const isPemValue = (value: string): boolean =>
  value.startsWith("-----BEGIN ") && value.includes("PRIVATE KEY-----");

const importPemPrivateKey = async (pem: string): Promise<CryptoKey> => {
  const { createPrivateKey } = await import("node:crypto");
  const key = createPrivateKey(pem);
  if (key.asymmetricKeyType !== "rsa") {
    throw new TypeError("privateKey PEM must contain an RSA private key.");
  }
  const pkcs8 = key.export({ format: "der", type: "pkcs8" });
  return globalThis.crypto.subtle.importKey(
    "pkcs8",
    new Uint8Array(pkcs8),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
};

const resolvePrivateKey = async (input: PrivateKeyInput): Promise<CryptoKey> => {
  if (typeof input !== "string" && !(input instanceof URL)) {
    validatePrivateKey(input);
    return input;
  }

  let pem: string;
  if (input instanceof URL) {
    const { readFile } = await import("node:fs/promises");
    pem = (await readFile(input, "utf8")).trim();
  } else {
    const value = input.trim();
    if (!value) {
      throw new TypeError("privateKey must not be empty.");
    }
    if (isPemValue(value)) {
      pem = value;
    } else {
      const { readFile } = await import("node:fs/promises");
      pem = (await readFile(value, "utf8")).trim();
    }
  }

  if (!pem) {
    throw new TypeError("privateKey PEM must not be empty.");
  }
  const privateKey = await importPemPrivateKey(pem);
  validatePrivateKey(privateKey);
  return privateKey;
};

const signAssertion = async (
  payload: Readonly<Record<string, string | number>>,
  privateKey: CryptoKey,
): Promise<string> => {
  validatePrivateKey(privateKey);
  const header = textBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const encodedPayload = textBase64Url(JSON.stringify(payload));
  const signingInput = `${header}.${encodedPayload}`;
  const signature = await globalThis.crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
};

export const createJwtBearerAssertion = async (
  options: JwtBearerAssertionOptions,
): Promise<string> => {
  const { expiresInSeconds, now } = assertionTiming(options);
  return signAssertion(
    {
      iss: nonEmptySecret(options.clientId, "clientId"),
      sub: nonEmptySecret(options.username, "username"),
      aud: parseOrigin(options.loginUrl, "loginUrl"),
      exp: now + expiresInSeconds,
    },
    await resolvePrivateKey(options.privateKey),
  );
};

/**
 * Creates the private_key_jwt client assertion accepted by Salesforce token
 * endpoints.
 */
export const createOAuthClientAssertion = async (
  options: OAuthClientAssertionOptions,
): Promise<string> => {
  const { expiresInSeconds, now } = assertionTiming(options);
  const clientId = nonEmptySecret(options.clientId, "clientId");
  const loginUrl = parseOAuthBaseUrl(options.loginUrl, "loginUrl");
  return signAssertion(
    {
      iss: clientId,
      sub: clientId,
      aud: `${loginUrl}/services/oauth2/token`,
      exp: now + expiresInSeconds,
    },
    await resolvePrivateKey(options.privateKey),
  );
};
