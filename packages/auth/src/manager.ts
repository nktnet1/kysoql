import type { OAuthRequestOptions } from "#/http";
import {
  refreshAccessToken,
  refreshHybridAccessToken,
  type SalesforceOAuthSession,
} from "#/oauth";
import type { RefreshTokenStore } from "#/storage";
import { nonEmptySecret, parseOAuthBaseUrl } from "#/validation";

/**
 * Describes whether an access-token provider should force a token refresh.
 */
export interface AccessTokenRequest {
  /** Whether the caller requires a freshly refreshed access token. */
  readonly refresh: boolean;
}

/**
 * Provides an access token, optionally forcing refresh for an authentication
 * retry.
 */
export type AccessTokenProvider = (
  options: AccessTokenRequest,
) => string | Promise<string>;

/**
 * Creates a client assertion, typically regenerated for each token refresh.
 */
export type ClientAssertionProvider = () => string | Promise<string>;

/**
 * Options for access-token management backed by a persistent refresh-token
 * store.
 */
export interface StoredRefreshTokenAuthOptions extends OAuthRequestOptions {
  /** Salesforce login or My Domain base URL used for token refresh. */
  readonly loginUrl: string;
  /** Connected App consumer key / OAuth client ID. */
  readonly clientId: string;
  /** Connected App client secret for confidential-client authentication. */
  readonly clientSecret?: string;
  /** Default: body. Salesforce also accepts HTTP Basic for client secrets. */
  readonly clientSecretTransport?: "body" | "basic";
  /**
   * Called for each refresh so short-lived client assertions can be
   * regenerated.
   */
  readonly clientAssertion?: ClientAssertionProvider;
  /**
   * Default: standard. Use hybrid only for Salesforce hybrid-app refresh
   * tokens.
   */
  readonly refreshMode?: "standard" | "hybrid";
  /** Store used to load and persist refresh tokens, including rotated tokens. */
  readonly refreshTokenStore: RefreshTokenStore;
  /**
   * Used only when the store is initially empty. Persisted after the first
   * successful refresh.
   */
  readonly initialRefreshToken?: string;
}

/**
 * Access-token manager that refreshes and persists rotated Salesforce
 * refresh tokens.
 */
export interface StoredRefreshTokenAuth {
  /** Returns the cached session, refreshing from the stored refresh token when needed. */
  getSession(): Promise<SalesforceOAuthSession>;
  /** Forces a token refresh and persists any rotated refresh token. */
  refresh(): Promise<SalesforceOAuthSession>;
  /** Provider suitable for REST clients that can request a forced refresh after authentication failure. */
  readonly accessTokenProvider: AccessTokenProvider;
  /** Clears cached session state and deletes the persisted refresh token. */
  clear(): Promise<void>;
}

/**
 * Creates a refresh-token-backed access-token manager with single-flight
 * refreshes.
 */
export const createStoredRefreshTokenAuth = (
  options: StoredRefreshTokenAuthOptions,
): StoredRefreshTokenAuth => {
  const loginUrl = parseOAuthBaseUrl(options.loginUrl, "loginUrl");
  const clientId = nonEmptySecret(options.clientId, "clientId");
  if (
    options.clientSecret !== undefined &&
    options.clientAssertion !== undefined
  ) {
    throw new TypeError("Provide clientSecret or clientAssertion, not both.");
  }
  if (
    options.clientSecret === undefined &&
    options.clientSecretTransport !== undefined
  ) {
    throw new TypeError(
      "clientSecretTransport can be used only when clientSecret is provided.",
    );
  }
  if (
    options.clientSecretTransport !== undefined &&
    options.clientSecretTransport !== "body" &&
    options.clientSecretTransport !== "basic"
  ) {
    throw new TypeError('clientSecretTransport must be "body" or "basic".');
  }
  const refreshMode = options.refreshMode ?? "standard";
  if (refreshMode !== "standard" && refreshMode !== "hybrid") {
    throw new TypeError('refreshMode must be "standard" or "hybrid".');
  }
  const initialRefreshToken =
    options.initialRefreshToken === undefined
      ? undefined
      : nonEmptySecret(options.initialRefreshToken, "initialRefreshToken");
  let session: SalesforceOAuthSession | undefined;
  let instanceUrl: string | undefined;
  let inFlight: Promise<SalesforceOAuthSession> | undefined;

  const runRefresh = async (): Promise<SalesforceOAuthSession> => {
    const stored = await options.refreshTokenStore.getRefreshToken();
    const refreshToken = stored ?? initialRefreshToken;
    if (refreshToken === undefined) {
      throw new Error("No refresh token is available in the configured store.");
    }
    const clientAssertion = await options.clientAssertion?.();
    const refreshTokenRequest =
      refreshMode === "hybrid" ? refreshHybridAccessToken : refreshAccessToken;
    const next = await refreshTokenRequest({
      loginUrl,
      clientId,
      refreshToken,
      refreshTokenStore: options.refreshTokenStore,
      ...(options.clientSecret === undefined
        ? {}
        : { clientSecret: options.clientSecret }),
      ...(options.clientSecretTransport === undefined
        ? {}
        : { clientSecretTransport: options.clientSecretTransport }),
      ...(clientAssertion === undefined ? {} : { clientAssertion }),
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.timeoutMs === undefined
        ? {}
        : { timeoutMs: options.timeoutMs }),
    });
    if (instanceUrl !== undefined && next.instanceUrl !== instanceUrl) {
      throw new Error(
        "Salesforce instance changed during token refresh; recreate the REST client.",
      );
    }
    instanceUrl ??= next.instanceUrl;
    if (next.refreshToken === undefined && stored === undefined) {
      await options.refreshTokenStore.setRefreshToken(refreshToken);
    }
    session = next;
    return next;
  };

  const refresh = (): Promise<SalesforceOAuthSession> => {
    if (inFlight !== undefined) {
      return inFlight;
    }
    const current = runRefresh().finally(() => {
      if (inFlight === current) {
        inFlight = undefined;
      }
    });
    inFlight = current;
    return current;
  };

  const getSession = (): Promise<SalesforceOAuthSession> =>
    session === undefined ? refresh() : Promise.resolve(session);

  const accessTokenProvider: AccessTokenProvider = async ({ refresh: force }) =>
    (force ? await refresh() : await getSession()).accessToken;

  return {
    getSession,
    refresh,
    accessTokenProvider,
    clear: async () => {
      session = undefined;
      instanceUrl = undefined;
      await options.refreshTokenStore.deleteRefreshToken();
    },
  };
};
