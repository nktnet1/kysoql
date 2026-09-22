import { SalesforceOAuthError, SalesforceResponseError } from "#/errors";
import { type HttpOptions, readJson, requestSignal } from "#/http";
import { isRecord, nonEmptySecret, parseOrigin } from "#/validation";

export interface SalesforceOAuthSession {
  readonly accessToken: string;
  readonly instanceUrl: string;
  /** Persist rotated refresh tokens securely; never assume the old one stays valid. */
  readonly refreshToken?: string;
}

export interface ClientCredentialsOptions extends HttpOptions {
  /** My Domain origin configured for the OAuth client-credentials flow. */
  readonly loginUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface RefreshTokenOptions extends HttpOptions {
  readonly loginUrl: string;
  readonly clientId: string;
  /** Required when the application's OAuth policy requires a secret for refresh. */
  readonly clientSecret?: string;
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
    cache: "no-store",
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
