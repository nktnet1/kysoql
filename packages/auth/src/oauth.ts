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

/**
 * Tokens and instance metadata returned by a Salesforce OAuth exchange.
 */
export interface SalesforceOAuthSession {
  /** Bearer access token returned by Salesforce. */
  readonly accessToken: string;
  /** Salesforce instance origin associated with the access token. */
  readonly instanceUrl: string;
  /** Refresh token returned or rotated by Salesforce, when present. */
  readonly refreshToken?: string;
  /** Space-delimited OAuth scope string returned by Salesforce, when present. */
  readonly scope?: string;
  /** OpenID Connect ID token returned by Salesforce, when requested. */
  readonly idToken?: string;
  /** Salesforce-issued timestamp from the token response, when present. */
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
  /** Salesforce login or My Domain base URL for the token endpoint. */
  readonly loginUrl: string;
  /**
   * Persist a newly issued/rotated refresh token before returning the session.
   */
  readonly refreshTokenStore?: RefreshTokenStore;
}

/** Options for the Salesforce OAuth client-credentials grant. */
export interface ClientCredentialsOptions extends TokenEndpointOptions {
  /** Salesforce My Domain origin configured for client credentials. */
  readonly clientId: string;
  /** Connected App client secret used by the client-credentials grant. */
  readonly clientSecret: string;
  /** Default: body. Salesforce also accepts HTTP Basic. */
  readonly clientSecretTransport?: "body" | "basic";
}

/** Options for exchanging a Salesforce authorization code for tokens. */
export interface AuthorizationCodeOptions
  extends TokenEndpointOptions,
    OAuthClientAuthentication {
  /** Connected App consumer key / OAuth client ID. */
  readonly clientId: string;
  /** Authorization code returned by Salesforce. */
  readonly code: string;
  /** Redirect URI used for the original authorization request. */
  readonly redirectUri: string;
  /** PKCE verifier corresponding to the authorization request challenge. */
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

/** Options for exchanging a Salesforce refresh token for a new session. */
export interface RefreshTokenOptions
  extends TokenEndpointOptions,
    OAuthClientAuthentication {
  /** Connected App consumer key / OAuth client ID. */
  readonly clientId: string;
  /** Refresh token to exchange for a new access token. */
  readonly refreshToken: string;
}

/** Options for the Salesforce JWT bearer token grant. */
export interface JwtBearerOptions extends TokenEndpointOptions {
  /** Signed JWT bearer assertion submitted to the Salesforce token endpoint. */
  readonly assertion: string;
}

/** Options for the Salesforce SAML bearer token grant. */
export interface SamlBearerOptions extends TokenEndpointOptions {
  /** Base64-encoded SAML bearer assertion submitted to Salesforce. */
  readonly assertion: string;
}

/** Options for the Salesforce SAML assertion token grant. */
export interface SamlAssertionOptions extends TokenEndpointOptions {
  /** SAML assertion submitted to the Salesforce assertion grant. */
  readonly assertion: string;
}

/** Subject-token types supported by Salesforce OAuth token exchange. */
export type TokenExchangeSubjectTokenType =
  | "urn:ietf:params:oauth:token-type:access_token"
  | "urn:ietf:params:oauth:token-type:refresh_token"
  | "urn:ietf:params:oauth:token-type:id_token"
  | "urn:ietf:params:oauth:token-type:saml2"
  | "urn:ietf:params:oauth:token-type:jwt";

/** Options for Salesforce OAuth 2.0 token exchange. */
export interface TokenExchangeOptions
  extends TokenEndpointOptions,
    OAuthClientAuthentication {
  /** Connected App consumer key / OAuth client ID. */
  readonly clientId: string;
  /** Token being exchanged. */
  readonly subjectToken: string;
  /** RFC token-type identifier describing `subjectToken`. */
  readonly subjectTokenType: TokenExchangeSubjectTokenType;
  /** Scopes requested for the exchanged token. */
  readonly scope?: string | readonly string[];
  /** Salesforce token-handler URL or identifier used for token exchange, when required. */
  readonly tokenHandler?: string;
}

/** Options for starting the Salesforce device authorization flow. */
export interface DeviceAuthorizationOptions extends OAuthRequestOptions {
  /** Salesforce login or My Domain base URL used for device authorization. */
  readonly loginUrl: string;
  /** Connected App consumer key / OAuth client ID. */
  readonly clientId: string;
  /** OAuth scopes requested by the device flow. */
  readonly scope?: string | readonly string[];
  /** Optional redirect URI forwarded to Salesforce for the device flow. */
  readonly redirectUri?: string;
}

/**
 * Device-code response returned when starting Salesforce device
 * authorization.
 */
export interface DeviceAuthorization {
  /** Opaque device code later exchanged by the polling client. */
  readonly deviceCode: string;
  /** Short code the user enters during device authorization. */
  readonly userCode: string;
  /** Salesforce URL where the user completes device authorization. */
  readonly verificationUri: string;
  /** Minimum polling interval requested by Salesforce, in seconds. */
  readonly intervalSeconds: number;
  /** Lifetime of the device code in seconds, when Salesforce supplies it. */
  readonly expiresInSeconds?: number;
}

/**
 * Options for polling Salesforce for completion of device authorization.
 */
export interface DeviceTokenOptions extends TokenEndpointOptions {
  /** Connected App consumer key / OAuth client ID. */
  readonly clientId: string;
  /** Device code returned by `startDeviceAuthorization`. */
  readonly deviceCode: string;
}

/** Options for building a Salesforce OAuth authorization URL. */
export interface AuthorizationUrlOptions {
  /** Salesforce login or My Domain base URL used for authorization. */
  readonly loginUrl: string;
  /** Connected App consumer key / OAuth client ID. */
  readonly clientId: string;
  /** Redirect URI registered with the Connected App. */
  readonly redirectUri: string;
  /** Requested OAuth scopes; arrays are serialized as a space-delimited value. */
  readonly scope?: string | readonly string[];
  /** Opaque state value returned unchanged by Salesforce for request correlation. */
  readonly state?: string;
  /** OpenID Connect nonce used to correlate an ID token with the authorization request. */
  readonly nonce?: string;
  /** OAuth `prompt` parameter forwarded to Salesforce. */
  readonly prompt?: string;
  /** Optional username/login hint forwarded to Salesforce. */
  readonly loginHint?: string;
  /** Salesforce `display` parameter for the authorization UI. */
  readonly display?: string;
  /** PKCE S256 code challenge paired with the verifier used during token exchange. */
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
            code_verifier: nonEmptySecret(options.codeVerifier, "codeVerifier"),
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

/**
 * Builds a validated Salesforce OAuth authorization URL without making a
 * network request.
 */
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
            token_handler: nonEmptyText(options.tokenHandler, "tokenHandler"),
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
