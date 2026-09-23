import { SalesforceOAuthError, SalesforceOAuthResponseError } from "#/errors";
import { type OAuthRequestOptions, readJson, requestSignal } from "#/http";
import { encodeBase64Url } from "#/pkce";
import type { RefreshTokenStore } from "#/storage";
import {
  isRecord,
  nonEmptySecret,
  nonEmptyText,
  parseAbsoluteRedirectUri,
  parseOAuthBaseUrl,
  parseOrigin,
  parseScope,
} from "#/validation";

export interface SalesforceOAuthSession {
  readonly accessToken: string;
  readonly instanceUrl: string;
  readonly refreshToken?: string;
  readonly scope?: string;
  readonly idToken?: string;
  readonly issuedAt?: string;
}

export interface OAuthClientAuthentication {
  /** Use only from a confidential client that can keep this secret. */
  readonly clientSecret?: string;
  /** JWT client assertion accepted by Salesforce instead of clientSecret. */
  readonly clientAssertion?: string;
  /** Default: body. Salesforce also accepts HTTP Basic for client secrets. */
  readonly clientSecretTransport?: "body" | "basic";
}

interface TokenEndpointOptions extends OAuthRequestOptions {
  readonly loginUrl: string;
  /**
   * Persist a newly issued/rotated refresh token before returning the session.
   */
  readonly refreshTokenStore?: RefreshTokenStore;
}

export interface ClientCredentialsOptions extends TokenEndpointOptions {
  /** Salesforce My Domain origin configured for client credentials. */
  readonly clientId: string;
  readonly clientSecret: string;
  /** Default: body. Salesforce also accepts HTTP Basic. */
  readonly clientSecretTransport?: "body" | "basic";
}

export interface AuthorizationCodeOptions
  extends TokenEndpointOptions,
    OAuthClientAuthentication {
  readonly clientId: string;
  readonly code: string;
  readonly redirectUri: string;
  readonly codeVerifier?: string;
  /**
   * Headless Identity code exchanges can require an Auth-Request-Type header,
   * for example "guest". Omit for ordinary web-server exchanges.
   */
  readonly authRequestType?: string;
  /**
   * Headless guest code exchanges require the raw UVID or UVID-bearing token
   * in the Uvid-Hint header. Do not add the authorization-request prefix here.
   */
  readonly uvidHint?: string;
}

export interface RefreshTokenOptions
  extends TokenEndpointOptions,
    OAuthClientAuthentication {
  readonly clientId: string;
  readonly refreshToken: string;
}

export interface JwtBearerOptions extends TokenEndpointOptions {
  readonly assertion: string;
}

export interface SamlBearerOptions extends TokenEndpointOptions {
  readonly assertion: string;
}

export interface SamlAssertionOptions extends TokenEndpointOptions {
  readonly assertion: string;
}

export type TokenExchangeSubjectTokenType =
  | "urn:ietf:params:oauth:token-type:access_token"
  | "urn:ietf:params:oauth:token-type:refresh_token"
  | "urn:ietf:params:oauth:token-type:id_token"
  | "urn:ietf:params:oauth:token-type:saml2"
  | "urn:ietf:params:oauth:token-type:jwt";

export interface TokenExchangeOptions
  extends TokenEndpointOptions,
    OAuthClientAuthentication {
  readonly clientId: string;
  readonly subjectToken: string;
  readonly subjectTokenType: TokenExchangeSubjectTokenType;
  readonly scope?: string | readonly string[];
  readonly tokenHandler?: string;
}

export interface DeviceAuthorizationOptions extends OAuthRequestOptions {
  readonly loginUrl: string;
  readonly clientId: string;
  readonly scope?: string | readonly string[];
  readonly redirectUri?: string;
}

export interface DeviceAuthorization {
  readonly deviceCode: string;
  readonly userCode: string;
  readonly verificationUri: string;
  readonly intervalSeconds: number;
  readonly expiresInSeconds?: number;
}

export interface DeviceTokenOptions extends TokenEndpointOptions {
  readonly clientId: string;
  readonly deviceCode: string;
}

export interface AuthorizationUrlOptions {
  readonly loginUrl: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scope?: string | readonly string[];
  readonly state?: string;
  readonly nonce?: string;
  readonly prompt?: string;
  readonly loginHint?: string;
  readonly display?: string;
  readonly codeChallenge?: string;
}

interface ClientAuthenticationParts {
  readonly parameters: Record<string, string>;
  readonly headers: Record<string, string>;
}

const TOKEN_EXCHANGE_SUBJECT_TOKEN_TYPES =
  new Set<TokenExchangeSubjectTokenType>([
    "urn:ietf:params:oauth:token-type:access_token",
    "urn:ietf:params:oauth:token-type:refresh_token",
    "urn:ietf:params:oauth:token-type:id_token",
    "urn:ietf:params:oauth:token-type:saml2",
    "urn:ietf:params:oauth:token-type:jwt",
  ]);

const base64 = (value: string): string => {
  const encoded = encodeBase64Url(new TextEncoder().encode(value));
  const standard = encoded.replaceAll("-", "+").replaceAll("_", "/");
  return `${standard}${"=".repeat((4 - (standard.length % 4)) % 4)}`;
};

const clientAuthentication = (
  options: OAuthClientAuthentication,
  clientIdValue: string,
): ClientAuthenticationParts => {
  const clientId = nonEmptySecret(clientIdValue, "clientId");
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
  if (options.clientSecret !== undefined) {
    const clientSecret = nonEmptySecret(options.clientSecret, "clientSecret");
    const transport = options.clientSecretTransport ?? "body";
    if (transport !== "body" && transport !== "basic") {
      throw new TypeError('clientSecretTransport must be "body" or "basic".');
    }
    if (transport === "basic") {
      return {
        parameters: {},
        headers: {
          Authorization: `Basic ${base64(`${clientId}:${clientSecret}`)}`,
        },
      };
    }
    return {
      parameters: { client_id: clientId, client_secret: clientSecret },
      headers: {},
    };
  }
  if (options.clientAssertion !== undefined) {
    return {
      parameters: {
        client_id: clientId,
        client_assertion: nonEmptySecret(
          options.clientAssertion,
          "clientAssertion",
        ),
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      },
      headers: {},
    };
  }
  return { parameters: { client_id: clientId }, headers: {} };
};

const parseSession = (body: unknown): SalesforceOAuthSession => {
  if (
    !isRecord(body) ||
    typeof body.access_token !== "string" ||
    typeof body.instance_url !== "string" ||
    (body.token_type !== undefined &&
      (typeof body.token_type !== "string" ||
        body.token_type.toLowerCase() !== "bearer")) ||
    (body.refresh_token !== undefined &&
      typeof body.refresh_token !== "string") ||
    (body.scope !== undefined && typeof body.scope !== "string") ||
    (body.id_token !== undefined && typeof body.id_token !== "string") ||
    (body.issued_at !== undefined && typeof body.issued_at !== "string")
  ) {
    throw new SalesforceOAuthResponseError(
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
    ...(body.scope === undefined ? {} : { scope: body.scope }),
    ...(body.id_token === undefined ? {} : { idToken: body.id_token }),
    ...(body.issued_at === undefined ? {} : { issuedAt: body.issued_at }),
  };
};

const postForm = async (
  options: OAuthRequestOptions & { readonly loginUrl: string },
  path: string,
  parameters: Record<string, string>,
  extraHeaders: Readonly<Record<string, string>> = {},
): Promise<{ readonly response: Response; readonly body: unknown }> => {
  const baseUrl = parseOAuthBaseUrl(options.loginUrl, "loginUrl");
  const signal = requestSignal(options);
  const fetch = options.fetch ?? globalThis.fetch;
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    redirect: "error",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      ...extraHeaders,
    },
    body: new URLSearchParams(parameters).toString(),
    signal,
  });
  return { response, body: await readJson(response, signal) };
};

const tokenRequest = async (
  options: TokenEndpointOptions,
  parameters: Record<string, string>,
  headers: Readonly<Record<string, string>> = {},
): Promise<SalesforceOAuthSession> => {
  const { response, body } = await postForm(
    options,
    "/services/oauth2/token",
    parameters,
    headers,
  );
  if (!response.ok) {
    throw new SalesforceOAuthError(
      response.status,
      isRecord(body) && typeof body.error === "string" ? body.error : undefined,
    );
  }
  const session = parseSession(body);
  if (
    session.refreshToken !== undefined &&
    options.refreshTokenStore !== undefined
  ) {
    await options.refreshTokenStore.setRefreshToken(session.refreshToken);
  }
  return session;
};

const authorizationCodeParameters = (
  options: AuthorizationCodeOptions,
  grantType: "authorization_code" | "hybrid_auth_code",
): ClientAuthenticationParts => {
  const auth = clientAuthentication(options, options.clientId);
  return {
    parameters: {
      grant_type: grantType,
      code: nonEmptySecret(options.code, "code"),
      redirect_uri: parseAbsoluteRedirectUri(options.redirectUri),
      ...(options.codeVerifier === undefined
        ? {}
        : {
            code_verifier: nonEmptySecret(
              options.codeVerifier,
              "codeVerifier",
            ),
          }),
      ...auth.parameters,
    },
    headers: {
      ...auth.headers,
      ...(options.authRequestType === undefined
        ? {}
        : {
            "Auth-Request-Type": nonEmptyText(
              options.authRequestType,
              "authRequestType",
            ),
          }),
      ...(options.uvidHint === undefined
        ? {}
        : { "Uvid-Hint": nonEmptySecret(options.uvidHint, "uvidHint") }),
    },
  };
};

export const createAuthorizationUrl = (
  options: AuthorizationUrlOptions,
): string => {
  const url = new URL(
    `${parseOAuthBaseUrl(options.loginUrl, "loginUrl")}/services/oauth2/authorize`,
  );
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "client_id",
    nonEmptySecret(options.clientId, "clientId"),
  );
  url.searchParams.set(
    "redirect_uri",
    parseAbsoluteRedirectUri(options.redirectUri),
  );
  const scope = parseScope(options.scope);
  if (scope !== undefined) {
    url.searchParams.set("scope", scope);
  }
  if (options.state !== undefined) {
    url.searchParams.set("state", nonEmptySecret(options.state, "state"));
  }
  if (options.nonce !== undefined) {
    url.searchParams.set("nonce", nonEmptySecret(options.nonce, "nonce"));
  }
  if (options.prompt !== undefined) {
    url.searchParams.set("prompt", nonEmptyText(options.prompt, "prompt"));
  }
  if (options.loginHint !== undefined) {
    url.searchParams.set(
      "login_hint",
      nonEmptyText(options.loginHint, "loginHint"),
    );
  }
  if (options.display !== undefined) {
    url.searchParams.set("display", nonEmptyText(options.display, "display"));
  }
  if (options.codeChallenge !== undefined) {
    url.searchParams.set(
      "code_challenge",
      nonEmptySecret(options.codeChallenge, "codeChallenge"),
    );
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.href;
};

/**
 * OAuth 2.0 client-credentials grant. Use a configured Salesforce My Domain.
 */
export const authenticateClientCredentials = async (
  options: ClientCredentialsOptions,
): Promise<SalesforceOAuthSession> => {
  const origin = parseOrigin(options.loginUrl, "loginUrl");
  if (
    origin === "https://login.salesforce.com" ||
    origin === "https://test.salesforce.com"
  ) {
    throw new TypeError(
      "client-credentials loginUrl must be a Salesforce My Domain origin.",
    );
  }
  const auth = clientAuthentication(options, options.clientId);
  return tokenRequest(
    options,
    { grant_type: "client_credentials", ...auth.parameters },
    auth.headers,
  );
};

/**
 * OAuth 2.0 web-server authorization-code exchange, including PKCE and
 * headless code exchanges.
 */
export const exchangeAuthorizationCode = async (
  options: AuthorizationCodeOptions,
): Promise<SalesforceOAuthSession> => {
  const request = authorizationCodeParameters(options, "authorization_code");
  return tokenRequest(options, request.parameters, request.headers);
};

/** OAuth 2.0 hybrid web-server authorization-code exchange. */
export const exchangeHybridAuthorizationCode = async (
  options: AuthorizationCodeOptions,
): Promise<SalesforceOAuthSession> => {
  const request = authorizationCodeParameters(options, "hybrid_auth_code");
  return tokenRequest(options, request.parameters, request.headers);
};

/**
 * OAuth 2.0 refresh-token exchange. Rotated refresh tokens are persisted when
 * a store is supplied.
 */
export const refreshAccessToken = async (
  options: RefreshTokenOptions,
): Promise<SalesforceOAuthSession> => {
  const auth = clientAuthentication(options, options.clientId);
  return tokenRequest(
    options,
    {
      grant_type: "refresh_token",
      refresh_token: nonEmptySecret(options.refreshToken, "refreshToken"),
      ...auth.parameters,
    },
    auth.headers,
  );
};

/**
 * Hybrid-app refresh exchange for a refresh token obtained by a supported
 * hybrid/web-server flow.
 */
export const refreshHybridAccessToken = async (
  options: RefreshTokenOptions,
): Promise<SalesforceOAuthSession> => {
  const auth = clientAuthentication(options, options.clientId);
  return tokenRequest(
    options,
    {
      grant_type: "hybrid_refresh",
      refresh_token: nonEmptySecret(options.refreshToken, "refreshToken"),
      ...auth.parameters,
    },
    auth.headers,
  );
};

/**
 * OAuth 2.0 JWT bearer token exchange. The assertion can be created with
 * createJwtBearerAssertion.
 */
export const authenticateJwtBearer = async (
  options: JwtBearerOptions,
): Promise<SalesforceOAuthSession> =>
  tokenRequest(options, {
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: nonEmptySecret(options.assertion, "assertion"),
  });

/** OAuth 2.0 SAML bearer assertion exchange. */
export const authenticateSamlBearer = async (
  options: SamlBearerOptions,
): Promise<SalesforceOAuthSession> =>
  tokenRequest(options, {
    grant_type: "urn:ietf:params:oauth:grant-type:saml2-bearer",
    assertion: nonEmptySecret(options.assertion, "assertion"),
  });

/** Salesforce SAML assertion flow for API access. */
export const authenticateSamlAssertion = async (
  options: SamlAssertionOptions,
): Promise<SalesforceOAuthSession> =>
  tokenRequest(options, {
    grant_type: "assertion",
    assertion_type: "urn:oasis:names:tc:SAML:2.0:profiles:SSO:browser",
    assertion: nonEmptySecret(options.assertion, "assertion"),
  });

/**
 * OAuth 2.0 token exchange using one of Salesforce's supported subject-token
 * types.
 */
export const exchangeToken = async (
  options: TokenExchangeOptions,
): Promise<SalesforceOAuthSession> => {
  const scope = parseScope(options.scope);
  if (!TOKEN_EXCHANGE_SUBJECT_TOKEN_TYPES.has(options.subjectTokenType)) {
    throw new TypeError(
      "subjectTokenType is not supported by Salesforce token exchange.",
    );
  }
  const auth = clientAuthentication(options, options.clientId);
  return tokenRequest(
    options,
    {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: nonEmptySecret(options.subjectToken, "subjectToken"),
      subject_token_type: options.subjectTokenType,
      ...(scope === undefined ? {} : { scope }),
      ...(options.tokenHandler === undefined
        ? {}
        : {
            token_handler: nonEmptyText(
              options.tokenHandler,
              "tokenHandler",
            ),
          }),
      ...auth.parameters,
    },
    auth.headers,
  );
};

/** Starts Salesforce's OAuth 2.0 device flow. */
export const requestDeviceAuthorization = async (
  options: DeviceAuthorizationOptions,
): Promise<DeviceAuthorization> => {
  const scope = parseScope(options.scope);
  const { response, body } = await postForm(options, "/services/oauth2/token", {
    response_type: "device_code",
    client_id: nonEmptySecret(options.clientId, "clientId"),
    ...(scope === undefined ? {} : { scope }),
    ...(options.redirectUri === undefined
      ? {}
      : { redirect_uri: parseAbsoluteRedirectUri(options.redirectUri) }),
  });
  if (!response.ok) {
    throw new SalesforceOAuthError(
      response.status,
      isRecord(body) && typeof body.error === "string" ? body.error : undefined,
    );
  }
  if (
    !isRecord(body) ||
    typeof body.device_code !== "string" ||
    typeof body.user_code !== "string" ||
    typeof body.verification_uri !== "string" ||
    typeof body.interval !== "number" ||
    !Number.isFinite(body.interval) ||
    body.interval <= 0 ||
    (body.expires_in !== undefined &&
      (typeof body.expires_in !== "number" ||
        !Number.isFinite(body.expires_in) ||
        body.expires_in <= 0))
  ) {
    throw new SalesforceOAuthResponseError(
      "Invalid Salesforce device-authorization response.",
    );
  }
  const verificationUri = new URL(body.verification_uri);
  if (verificationUri.protocol !== "https:") {
    throw new SalesforceOAuthResponseError(
      "Salesforce device verification URI must use HTTPS.",
    );
  }
  return {
    deviceCode: nonEmptySecret(body.device_code, "device_code"),
    userCode: nonEmptySecret(body.user_code, "user_code"),
    verificationUri: verificationUri.href,
    intervalSeconds: body.interval,
    ...(body.expires_in === undefined
      ? {}
      : { expiresInSeconds: body.expires_in }),
  };
};

/**
 * Performs one device-flow polling exchange. Handle authorization_pending or
 * slow_down and poll again.
 */
export const pollDeviceAuthorization = async (
  options: DeviceTokenOptions,
): Promise<SalesforceOAuthSession> =>
  tokenRequest(options, {
    grant_type: "device",
    client_id: nonEmptySecret(options.clientId, "clientId"),
    code: nonEmptySecret(options.deviceCode, "deviceCode"),
  });
