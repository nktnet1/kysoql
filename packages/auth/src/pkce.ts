import { nonEmptySecret } from "#/validation";

const BASE64URL =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const base64UrlEncode = (bytes: Uint8Array): string => {
  let result = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    result += BASE64URL[first >> 2] ?? "";
    result += BASE64URL[((first & 0x03) << 4) | ((second ?? 0) >> 4)] ?? "";
    if (second !== undefined) {
      result += BASE64URL[((second & 0x0f) << 2) | ((third ?? 0) >> 6)] ?? "";
    }
    if (third !== undefined) {
      result += BASE64URL[third & 0x3f] ?? "";
    }
  }
  return result;
};

const PKCE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

/** Derives an S256 PKCE code challenge from a verifier. */
export const createPkceChallenge = async (
  verifier: string,
): Promise<string> => {
  nonEmptySecret(verifier, "verifier");
  if (!PKCE_VERIFIER.test(verifier)) {
    throw new TypeError(
      "verifier must be 43-128 RFC 7636 unreserved characters.",
    );
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64UrlEncode(new Uint8Array(digest));
};

/** PKCE verifier and matching S256 challenge. */
export interface PkcePair {
  /** High-entropy PKCE code verifier retained for the token exchange. */
  readonly verifier: string;
  /** Base64url-encoded SHA-256 challenge sent during authorization. */
  readonly challenge: string;
}

/**
 * Generates a cryptographically random PKCE verifier and its S256 challenge.
 */
export const generatePkcePair = async (): Promise<PkcePair> => {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(96));
  const verifier = base64UrlEncode(bytes);
  return {
    verifier,
    challenge: await createPkceChallenge(verifier),
  };
};

export const encodeBase64Url = base64UrlEncode;
