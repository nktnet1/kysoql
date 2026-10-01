import { SalesforceOAuthError, SalesforceResponseError } from "#src/errors";
import { type HttpOptions, readJson, requestSignal } from "#src/http";
import { isRecord, nonEmptySecret, parseOrigin } from "#src/validation";

/**
 * Access-token and instance metadata returned by the REST package OAuth
 * helpers.
 */
export interface SalesforceOAuthSession {
  /** Bearer access token returned by Salesforce. */
  readonly accessToken: string;
  /** Salesforce instance origin associated with the access token. */
  readonly instanceUrl: string;
  /** Persist rotated refresh tokens securely; never assume the old one stays valid. */
  readonly refreshToken?: string;
}

/**
 * Options for the Salesforce client-credentials grant in the REST package.
 */
export interface ClientCredentialsOptions extends HttpOptions {
  /** My Domain origin configured for the OAuth client-credentials flow. */
  readonly loginUrl: string;
  /** Connected App consumer key / OAuth client ID. */
  readonly clientId: string;
  /** Connected App client secret used by the client-credentials grant. */
  readonly clientSecret: string;
}

/** Options for the Salesforce refresh-token grant in the REST package. */
export interface RefreshTokenOptions extends HttpOptions {
  /** Salesforce login or My Domain base URL. */
  readonly loginUrl: string;
  /** Connected App consumer key / OAuth client ID. */
  readonly clientId: string;
  /** Required when the application's OAuth policy requires a secret for refresh. */
  readonly clientSecret?: string;
  /** Refresh token to exchange for a new access token. */
  readonly refreshToken: string;
}

const tokenRequest = async (
  options: HttpOptions & { readonly loginUrl: string },
  parameters: Record<string, string>,
): Promise<SalesforceOAuthSession> => {
  const origin = parseOrigin(options.loginUrl, "loginUrl");
  const signal = requestSignal(options, {});
  const fetch = options.fetch ?? globalThis.fetch;
  const response = await fetch(`${origin}/services/oauth2/token`, {
    method: "POST",
    redirect: "error",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(parameters).toString(),
    signal,
  });
  const body = await readJson(response, signal);
  if (!response.ok) {
    throw new SalesforceOAuthError(
      response.status,
      isRecord(body) && typeof body.error === "string" ? body.error : undefined,
    );
  }
  if (
    !isRecord(body) ||
    typeof body.access_token !== "string" ||
    typeof body.instance_url !== "string" ||
    (body.token_type !== undefined &&
      (typeof body.token_type !== "string" ||
        body.token_type.toLowerCase() !== "bearer")) ||
    (body.refresh_token !== undefined && typeof body.refresh_token !== "string")
  ) {
    throw new SalesforceResponseError(
      "Invalid Salesforce OAuth token response.",
    );
  }
  return {
    accessToken: nonEmptySecret(body.access_token, "OAuth access token"),
    instanceUrl: parseOrigin(body.instance_url, "OAuth instance URL"),
    ...(body.refresh_token === undefined
      ? {}
      : {
          refreshToken: nonEmptySecret(
            body.refresh_token,
            "OAuth refresh token",
          ),
        }),
  };
};

/** One token exchange. Configure the OAuth application in Salesforce first. */
export const authenticateClientCredentials = async (
  options: ClientCredentialsOptions,
): Promise<SalesforceOAuthSession> =>
  tokenRequest(options, {
    grant_type: "client_credentials",
    client_id: nonEmptySecret(options.clientId, "clientId"),
    client_secret: nonEmptySecret(options.clientSecret, "clientSecret"),
  });

/** One refresh exchange. Interactive authorisation and secure token storage stay in the application. */
export const refreshAccessToken = async (
  options: RefreshTokenOptions,
): Promise<SalesforceOAuthSession> =>
  tokenRequest(options, {
    grant_type: "refresh_token",
    client_id: nonEmptySecret(options.clientId, "clientId"),
    refresh_token: nonEmptySecret(options.refreshToken, "refreshToken"),
    ...(options.clientSecret === undefined
      ? {}
      : {
          client_secret: nonEmptySecret(options.clientSecret, "clientSecret"),
        }),
  });
