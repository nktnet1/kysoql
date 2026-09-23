import { SalesforceOAuthError, SalesforceOAuthResponseError } from "#/errors";
import { type OAuthRequestOptions, readJson, requestSignal } from "#/http";
import { encodeBase64Url } from "#/pkce";
import {
  isRecord,
  nonEmptySecret,
  nonEmptyText,
  parseAbsoluteRedirectUri,
  parseOAuthBaseUrl,
  parseScope,
} from "#/validation";

export interface HeadlessAuthorizationRequest {
  readonly url: string;
  readonly init: RequestInit;
}

interface CodeCredentialsAuthorizationBase {
  /** Experience Cloud site base URL, including a site path when configured. */
  readonly siteUrl: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly codeChallenge?: string;
  readonly scope?: string | readonly string[];
  readonly state?: string;
  /** Plain UVID body parameter. Mutually exclusive with uvidHintToken. */
  readonly uvidHint?: string;
  /** JWT-based access token containing a UVID, sent as the Uvid-Hint header. */
  readonly uvidHintToken?: string;
}

export interface CodeCredentialsNamedUserOptions
  extends CodeCredentialsAuthorizationBase {
  readonly username: string;
  readonly password: string;
  /**
   * Default: authorization-header. Use body when the app requires POST-body
   * credentials.
   */
  readonly credentialsPlacement?: "authorization-header" | "body";
  readonly loginHint?: never;
  readonly customData?: never;
}

export interface CodeCredentialsUserDiscoveryOptions
  extends CodeCredentialsAuthorizationBase {
  /** Headless user-discovery identifier passed to the Apex discovery handler. */
  readonly loginHint: string;
  readonly password: string;
  readonly customData?: string;
  readonly username?: never;
  /** User-discovery credentials must be sent in the POST body. */
  readonly credentialsPlacement?: "body";
}

export type CodeCredentialsAuthorizationOptions =
  | CodeCredentialsNamedUserOptions
  | CodeCredentialsUserDiscoveryOptions;

const base64 = (value: string): string => {
  const encoded = encodeBase64Url(new TextEncoder().encode(value));
  const standard = encoded.replaceAll("-", "+").replaceAll("_", "/");
  return `${standard}${"=".repeat((4 - (standard.length % 4)) % 4)}`;
};

/**
 * Builds the POST used by Salesforce Headless Identity's Authorization Code and
 * Credentials flow. The returned request uses redirect: "manual" so credentials
 * aren't automatically forwarded through a redirect by fetch.
 */
export const createCodeCredentialsAuthorizationRequest = (
  options: CodeCredentialsAuthorizationOptions,
): HeadlessAuthorizationRequest => {
  const siteUrl = parseOAuthBaseUrl(options.siteUrl, "siteUrl");
  const password = nonEmptySecret(options.password, "password");
  if (
    options.uvidHint !== undefined &&
    options.uvidHintToken !== undefined
  ) {
    throw new TypeError("Provide uvidHint or uvidHintToken, not both.");
  }
  const isUserDiscovery = options.username === undefined;
  if (!isUserDiscovery && options.loginHint !== undefined) {
    throw new TypeError("Provide username or loginHint, not both.");
  }
  const placement =
    options.credentialsPlacement ??
    (isUserDiscovery ? "body" : "authorization-header");
  if (placement !== "authorization-header" && placement !== "body") {
    throw new TypeError(
      'credentialsPlacement must be "authorization-header" or "body".',
    );
  }
  if (isUserDiscovery && placement !== "body") {
    throw new TypeError(
      'Headless user discovery requires credentialsPlacement: "body".',
    );
  }
  const scope = parseScope(options.scope);
  const parameters = new URLSearchParams({
    response_type: "code_credentials",
    client_id: nonEmptySecret(options.clientId, "clientId"),
    redirect_uri: parseAbsoluteRedirectUri(options.redirectUri),
    ...(options.codeChallenge === undefined
      ? {}
      : {
          code_challenge: nonEmptySecret(
            options.codeChallenge,
            "codeChallenge",
          ),
        }),
    ...(scope === undefined ? {} : { scope }),
    ...(options.state === undefined
      ? {}
      : { state: nonEmptySecret(options.state, "state") }),
    ...(options.uvidHint === undefined
      ? {}
      : { uvid_hint: nonEmptyText(options.uvidHint, "uvidHint") }),
    ...(isUserDiscovery
      ? {
          login_hint: nonEmptyText(options.loginHint, "loginHint"),
          password,
          ...(options.customData === undefined
            ? {}
            : {
                customdata: nonEmptyText(
                  options.customData,
                  "customData",
                ),
              }),
        }
      : placement === "body"
        ? { username: nonEmptySecret(options.username, "username"), password }
        : {}),
  });
  return {
    url: `${siteUrl}/services/oauth2/authorize`,
    init: {
      method: "POST",
      redirect: "manual",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Auth-Request-Type": "Named-User",
        "Content-Type": "application/x-www-form-urlencoded",
        ...(options.uvidHintToken === undefined
          ? {}
          : {
              "Uvid-Hint": nonEmptySecret(
                options.uvidHintToken,
                "uvidHintToken",
              ),
            }),
        ...(placement === "authorization-header" && !isUserDiscovery
          ? {
              Authorization: `Basic ${base64(
                `${nonEmptySecret(options.username, "username")}:${password}`,
              )}`,
            }
          : {}),
      },
      body: parameters.toString(),
    },
  };
};

interface HeadlessGuestAuthorizationBase {
  /** Experience Cloud site base URL, including a site path when configured. */
  readonly siteUrl: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly codeChallenge?: string;
  readonly scope?: string | readonly string[];
  readonly state?: string;
  /** Default: header. Salesforce also accepts the prefixed value in the body. */
  readonly uvidPlacement?: "header" | "body";
}

export type HeadlessGuestAuthorizationOptions =
  HeadlessGuestAuthorizationBase &
    (
      | {
          /** Plain UVID generated and managed by the application. */
          readonly uvidHint: string;
          readonly uvidHintToken?: never;
        }
      | {
          readonly uvidHint?: never;
          /** JWT-based Salesforce access token that contains the UVID. */
          readonly uvidHintToken: string;
        }
    );

/**
 * Builds the authorization request for Salesforce Headless Identity's guest
 * variation of Authorization Code and Credentials. Salesforce requires the
 * UVID/JWT prefix during authorization; the later token exchange uses the raw
 * value through exchangeAuthorizationCode({ authRequestType: "guest", ... }).
 */
export const createHeadlessGuestAuthorizationRequest = (
  options: HeadlessGuestAuthorizationOptions,
): HeadlessAuthorizationRequest => {
  const siteUrl = parseOAuthBaseUrl(options.siteUrl, "siteUrl");
  if (
    (options.uvidHint === undefined) ===
    (options.uvidHintToken === undefined)
  ) {
    throw new TypeError("Provide exactly one of uvidHint or uvidHintToken.");
  }
  const placement = options.uvidPlacement ?? "header";
  if (placement !== "header" && placement !== "body") {
    throw new TypeError('uvidPlacement must be "header" or "body".');
  }
  const prefixedUvid =
    options.uvidHint === undefined
      ? `JWT ${nonEmptySecret(options.uvidHintToken, "uvidHintToken")}`
      : `UVID ${nonEmptySecret(options.uvidHint, "uvidHint")}`;
  const scope = parseScope(options.scope);
  const parameters = new URLSearchParams({
    response_type: "code_credentials",
    client_id: nonEmptySecret(options.clientId, "clientId"),
    redirect_uri: parseAbsoluteRedirectUri(options.redirectUri),
    ...(options.codeChallenge === undefined
      ? {}
      : {
          code_challenge: nonEmptySecret(
            options.codeChallenge,
            "codeChallenge",
          ),
        }),
    ...(scope === undefined ? {} : { scope }),
    ...(options.state === undefined
      ? {}
      : { state: nonEmptySecret(options.state, "state") }),
    ...(placement === "body" ? { uvid_hint: prefixedUvid } : {}),
  });
  return {
    url: `${siteUrl}/services/oauth2/authorize`,
    init: {
      method: "POST",
      redirect: "manual",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Auth-Request-Type": "guest",
        "Content-Type": "application/x-www-form-urlencoded",
        ...(placement === "header" ? { "Uvid-Hint": prefixedUvid } : {}),
      },
      body: parameters.toString(),
    },
  };
};

export interface FirstPartyAuthorizationChallengeOptions
  extends OAuthRequestOptions {
  /** Experience Cloud site base URL, including a site path when configured. */
  readonly siteUrl: string;
  /** Flow-specific body parameters documented by Salesforce. */
  readonly parameters: Readonly<Record<string, FirstPartyAuthorizationValue>>;
  /** Default: form. Use json for flows such as headless registration. */
  readonly bodyFormat?: "form" | "json";
  /** Optional UVID JWT access token used to carry guest-session context. */
  readonly uvidHintToken?: string;
  /**
   * Optional bearer token for flows whose Experience Cloud policy requires
   * one.
   */
  readonly accessToken?: string;
}

export type FirstPartyAuthorizationValue =
  | string
  | number
  | boolean
  | null
  | readonly FirstPartyAuthorizationValue[]
  | { readonly [key: string]: FirstPartyAuthorizationValue };

export type FirstPartyAuthorizationChallenge =
  | {
      readonly kind: "authorized";
      readonly authorizationCode: string;
    }
  | {
      readonly kind: "challenge";
      readonly status: number;
      readonly error: string;
      readonly errorCode?: string;
      readonly authSession: string;
      /** Flow-specific response fields such as login_status. */
      readonly response: Readonly<Record<string, unknown>>;
    };

/**
 * Calls the OAuth 2.0 for First-Party Applications authorization-challenge
 * endpoint. The generic parameter bag intentionally follows Salesforce because
 * login, passwordless, registration, reCAPTCHA, and continuation steps require
 * different documented fields.
 */
export const requestFirstPartyAuthorizationChallenge = async (
  options: FirstPartyAuthorizationChallengeOptions,
): Promise<FirstPartyAuthorizationChallenge> => {
  const siteUrl = parseOAuthBaseUrl(options.siteUrl, "siteUrl");
  const signal = requestSignal(options);
  const fetch = options.fetch ?? globalThis.fetch;
  const bodyFormat = options.bodyFormat ?? "form";
  if (bodyFormat !== "form" && bodyFormat !== "json") {
    throw new TypeError('bodyFormat must be "form" or "json".');
  }
  let requestBody: string;
  if (bodyFormat === "json") {
    try {
      requestBody = JSON.stringify(options.parameters);
    } catch {
      throw new TypeError("parameters must be JSON serializable.");
    }
  } else {
    const parameters = new URLSearchParams();
    for (const [name, value] of Object.entries(options.parameters)) {
      if (typeof value !== "string") {
        throw new TypeError(
          `${name} must be a string when bodyFormat is \"form\".`,
        );
      }
      parameters.set(
        nonEmptyText(name, "parameter name"),
        nonEmptyText(value, name),
      );
    }
    requestBody = parameters.toString();
  }
  const response = await fetch(
    `${siteUrl}/services/oauth2/v1/authorization_challenge`,
    {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type":
          bodyFormat === "json"
            ? "application/json"
            : "application/x-www-form-urlencoded",
        ...(options.uvidHintToken === undefined
          ? {}
          : {
              "Uvid-Hint": nonEmptySecret(
                options.uvidHintToken,
                "uvidHintToken",
              ),
            }),
        ...(options.accessToken === undefined
          ? {}
          : {
              Authorization: `Bearer ${nonEmptySecret(
                options.accessToken,
                "accessToken",
              )}`,
            }),
      },
      body: requestBody,
      signal,
    },
  );
  const responseBody = await readJson(response, signal);
  if (response.ok) {
    if (
      !isRecord(responseBody) ||
      typeof responseBody.authorization_code !== "string"
    ) {
      throw new SalesforceOAuthResponseError(
        "Invalid Salesforce authorization-challenge response.",
      );
    }
    return {
      kind: "authorized",
      authorizationCode: nonEmptySecret(
        responseBody.authorization_code,
        "authorization_code",
      ),
    };
  }
  if (
    isRecord(responseBody) &&
    typeof responseBody.error === "string" &&
    typeof responseBody.auth_session === "string"
  ) {
    return {
      kind: "challenge",
      status: response.status,
      error: nonEmptyText(responseBody.error, "error"),
      ...(typeof responseBody.error_code === "string"
        ? { errorCode: nonEmptyText(responseBody.error_code, "error_code") }
        : {}),
      authSession: nonEmptySecret(responseBody.auth_session, "auth_session"),
      response: responseBody,
    };
  }
  throw new SalesforceOAuthError(
    response.status,
    isRecord(responseBody) && typeof responseBody.error === "string"
      ? responseBody.error
      : undefined,
  );
};
