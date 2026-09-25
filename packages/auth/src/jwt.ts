import { encodeBase64Url } from "#/pkce";
import {
  isRecord,
  nonEmptySecret,
  parseOAuthBaseUrl,
  parseOrigin,
} from "#/validation";

const textBase64Url = (value: string): string =>
  encodeBase64Url(new TextEncoder().encode(value));

/**
 * Supported sources for the RSA private key used to sign Salesforce JWT
 * assertions.
 */
export type PrivateKeyInput =
  | {
      /** Selects an already-imported Web Crypto key. */
      readonly type: "crypto-key";
      /** RSA private key used for RS256 signing. */
      readonly key: CryptoKey;
    }
  | {
      /** Selects an in-memory PEM-encoded private key. */
      readonly type: "pem";
      /** PEM-encoded PKCS#8 RSA private key. */
      readonly value: string;
    }
  | {
      /** Selects a private key loaded from the filesystem. */
      readonly type: "file";
      /** Path or file URL containing the private key. */
      readonly path: string | URL;
    };

/** Options for creating a Salesforce JWT bearer assertion. */
export interface JwtBearerAssertionOptions {
  /** Connected App consumer key / OAuth client ID. */
  readonly clientId: string;
  /** Salesforce username associated with the authorization flow. */
  readonly username: string;
  /** Salesforce login/My Domain origin used as the JWT audience. */
  readonly loginUrl: string;
  /** RS256 signing key with an explicit source type. */
  readonly privateKey: PrivateKeyInput;
  /** Default: 180 seconds. Maximum: 300 seconds. */
  readonly expiresInSeconds?: number;
  /**
   * Unix timestamp in seconds. Defaults to the current time. Useful for
   * deterministic tests.
   */
  readonly now?: number;
}

/**
 * Options for creating a private_key_jwt client assertion for Salesforce
 * OAuth.
 */
export interface OAuthClientAssertionOptions {
  /** Connected App consumer key / OAuth client ID. */
  readonly clientId: string;
  /**
   * Salesforce login/My Domain or Experience Cloud base URL whose token endpoint
   * receives the assertion.
   */
  readonly loginUrl: string;
  /** RS256 signing key with an explicit source type. */
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
    privateKey.algorithm?.name !== "RSASSA-PKCS1-v1_5"
  ) {
    throw new TypeError(
      "privateKey must be an RSASSA-PKCS1-v1_5 private CryptoKey.",
    );
  }
};

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

const resolvePrivateKey = async (
  input: PrivateKeyInput,
): Promise<CryptoKey> => {
  const candidate: unknown = input;
  if (!isRecord(candidate)) {
    throw new TypeError(
      'privateKey must be an object with type "file", "pem", or "crypto-key".',
    );
  }

  switch (candidate.type) {
    case "crypto-key": {
      const key = candidate.key;
      if (key === null || typeof key !== "object") {
        throw new TypeError(
          'privateKey with type "crypto-key" requires a CryptoKey in key.',
        );
      }
      validatePrivateKey(key as CryptoKey);
      return key as CryptoKey;
    }
    case "pem": {
      if (typeof candidate.value !== "string") {
        throw new TypeError(
          'privateKey with type "pem" requires a PEM string in value.',
        );
      }
      const pem = candidate.value.trim();
      if (!pem) {
        throw new TypeError("privateKey.value must not be empty.");
      }
      const key = await importPemPrivateKey(pem);
      validatePrivateKey(key);
      return key;
    }
    case "file": {
      const path = candidate.path;
      if (typeof path !== "string" && !(path instanceof URL)) {
        throw new TypeError(
          'privateKey with type "file" requires a string or file URL in path.',
        );
      }
      const normalizedPath = typeof path === "string" ? path.trim() : path;
      if (typeof normalizedPath === "string" && !normalizedPath) {
        throw new TypeError("privateKey.path must not be empty.");
      }
      if (
        normalizedPath instanceof URL &&
        normalizedPath.protocol !== "file:"
      ) {
        throw new TypeError("privateKey.path URL must use the file: protocol.");
      }
      const { readFile } = await import("node:fs/promises");
      const pem = (await readFile(normalizedPath, "utf8")).trim();
      if (!pem) {
        throw new TypeError("privateKey file must contain a PEM private key.");
      }
      const key = await importPemPrivateKey(pem);
      validatePrivateKey(key);
      return key;
    }
    default:
      throw new TypeError(
        'privateKey.type must be "file", "pem", or "crypto-key".',
      );
  }
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

/**
 * Creates an RS256 JWT bearer assertion for Salesforce server-to-server
 * authentication.
 */
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
