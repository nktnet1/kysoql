import type { OAuthRequestOptions } from "#/http";
import {
  refreshAccessToken,
  refreshHybridAccessToken,
  type SalesforceOAuthSession,
} from "#/oauth";
import type { RefreshTokenStore } from "#/storage";
import { nonEmptySecret, parseOAuthBaseUrl } from "#/validation";

export interface AccessTokenRequest {
  readonly refresh: boolean;
}

export type AccessTokenProvider = (
  options: AccessTokenRequest,
) => string | Promise<string>;

export type ClientAssertionProvider = () => string | Promise<string>;

export interface StoredRefreshTokenAuthOptions extends OAuthRequestOptions {
  readonly loginUrl: string;
  readonly clientId: string;
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
  readonly refreshTokenStore: RefreshTokenStore;
  /**
   * Used only when the store is initially empty. Persisted after the first
   * successful refresh.
   */
  readonly initialRefreshToken?: string;
}

export interface StoredRefreshTokenAuth {
  getSession(): Promise<SalesforceOAuthSession>;
  refresh(): Promise<SalesforceOAuthSession>;
  readonly accessTokenProvider: AccessTokenProvider;
  clear(): Promise<void>;
}

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
