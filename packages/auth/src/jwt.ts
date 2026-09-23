import { encodeBase64Url } from "#/pkce";
import {
  nonEmptySecret,
  parseOAuthBaseUrl,
  parseOrigin,
} from "#/validation";

const textBase64Url = (value: string): string =>
  encodeBase64Url(new TextEncoder().encode(value));

export interface JwtBearerAssertionOptions {
  readonly clientId: string;
  readonly username: string;
  /** Salesforce login/My Domain origin used as the JWT audience. */
  readonly loginUrl: string;
  /**
   * RS256 signing key. Generate/import it with Web Crypto; keep it server-side.
   */
  readonly privateKey: CryptoKey;
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
   * RS256 signing key. Generate/import it with Web Crypto; keep it server-side.
   */
  readonly privateKey: CryptoKey;
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
    throw new TypeError("expiresInSeconds must be an integer between 1 and 300.");
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
    options.privateKey,
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
    options.privateKey,
  );
};
