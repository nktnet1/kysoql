import {
  type CodeCredentialsAuthorizationOptions,
  createCodeCredentialsAuthorizationRequest,
  createHeadlessGuestAuthorizationRequest,
  type FirstPartyAuthorizationChallenge,
  type FirstPartyAuthorizationChallengeOptions,
  type HeadlessAuthorizationRequest,
  type HeadlessGuestAuthorizationOptions,
  requestFirstPartyAuthorizationChallenge,
} from "#/headless";
import type { OAuthRequestOptions } from "#/http";
import {
  createJwtBearerAssertion,
  createOAuthClientAssertion,
  type JwtBearerAssertionOptions,
  type OAuthClientAssertionOptions,
} from "#/jwt";
import {
  createStoredRefreshTokenAuth,
  type StoredRefreshTokenAuth,
  type StoredRefreshTokenAuthOptions,
} from "#/manager";
import {
  authenticateClientCredentials,
  authenticateJwtBearer,
  authenticateSamlAssertion,
  authenticateSamlBearer,
  type AuthorizationCodeOptions,
  type AuthorizationUrlOptions,
  type ClientCredentialsOptions,
  createAuthorizationUrl,
  type DeviceAuthorization,
  type DeviceAuthorizationOptions,
  type DeviceTokenOptions,
  exchangeAuthorizationCode,
  exchangeHybridAuthorizationCode,
  exchangeToken,
  type RefreshTokenOptions,
  refreshAccessToken,
  refreshHybridAccessToken,
  requestDeviceAuthorization,
  type SalesforceOAuthSession,
  type SamlAssertionOptions,
  type SamlBearerOptions,
  type TokenExchangeOptions,
  pollDeviceAuthorization,
} from "#/oauth";
import { generatePkcePair, type PkcePair } from "#/pkce";
import { nonEmptySecret, parseOAuthBaseUrl } from "#/validation";

export interface SalesforceAuthOptions extends OAuthRequestOptions {
  /** Salesforce login, My Domain, or Experience Cloud site base URL. */
  readonly loginUrl: string;
  /** External Client App / Connected App consumer key. */
  readonly clientId: string;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, Extract<keyof T, K>>
  : never;

type BoundAuthorizationUrlOptions = Omit<
  AuthorizationUrlOptions,
  "loginUrl" | "clientId"
>;
type BoundAuthorizationCodeOptions = Omit<
  AuthorizationCodeOptions,
  "loginUrl" | "clientId"
>;
type BoundClientCredentialsOptions = Omit<
  ClientCredentialsOptions,
  "loginUrl" | "clientId"
>;
type BoundRefreshTokenOptions = Omit<
  RefreshTokenOptions,
  "loginUrl" | "clientId"
>;
type BoundSamlBearerOptions = Omit<SamlBearerOptions, "loginUrl">;
type BoundSamlAssertionOptions = Omit<SamlAssertionOptions, "loginUrl">;
type BoundTokenExchangeOptions = Omit<
  TokenExchangeOptions,
  "loginUrl" | "clientId"
>;
type BoundDeviceAuthorizationOptions = Omit<
  DeviceAuthorizationOptions,
  "loginUrl" | "clientId"
>;
type BoundDeviceTokenOptions = Omit<
  DeviceTokenOptions,
  "loginUrl" | "clientId"
>;
type BoundStoredRefreshTokenAuthOptions = Omit<
  StoredRefreshTokenAuthOptions,
  "loginUrl" | "clientId"
>;
type BoundCodeCredentialsAuthorizationOptions = DistributiveOmit<
  CodeCredentialsAuthorizationOptions,
  "siteUrl" | "clientId"
>;
type BoundHeadlessGuestAuthorizationOptions = DistributiveOmit<
  HeadlessGuestAuthorizationOptions,
  "siteUrl" | "clientId"
>;
type BoundFirstPartyAuthorizationChallengeOptions = Omit<
  FirstPartyAuthorizationChallengeOptions,
  "siteUrl"
>;

export interface SalesforceJwtBearerOptions extends OAuthRequestOptions {
  readonly username: string;
  readonly privateKey: CryptoKey;
  readonly expiresInSeconds?: number;
  readonly now?: number;
}

export type SalesforceClientAssertionOptions = Omit<
  OAuthClientAssertionOptions,
  "loginUrl" | "clientId"
>;

const requestOptions = (
  defaults: OAuthRequestOptions,
  overrides: OAuthRequestOptions,
): OAuthRequestOptions => ({
  ...(defaults.fetch === undefined ? {} : { fetch: defaults.fetch }),
  ...(defaults.signal === undefined ? {} : { signal: defaults.signal }),
  ...(defaults.timeoutMs === undefined
    ? {}
    : { timeoutMs: defaults.timeoutMs }),
  ...(overrides.fetch === undefined ? {} : { fetch: overrides.fetch }),
  ...(overrides.signal === undefined ? {} : { signal: overrides.signal }),
  ...(overrides.timeoutMs === undefined
    ? {}
    : { timeoutMs: overrides.timeoutMs }),
});

/**
 * Bound Salesforce OAuth client.
 *
 * The class is the primary ergonomic API for applications. The standalone
 * functions remain exported for advanced composition and backwards
 * compatibility.
 */
export class SalesforceAuth {
  readonly loginUrl: string;
  readonly clientId: string;
  readonly #requestDefaults: OAuthRequestOptions;

  constructor(options: SalesforceAuthOptions) {
    this.loginUrl = parseOAuthBaseUrl(options.loginUrl, "loginUrl");
    this.clientId = nonEmptySecret(options.clientId, "clientId");
    this.#requestDefaults = requestOptions({}, options);
  }

  /** Generate an RFC 7636 S256 verifier/challenge pair. */
  generatePkcePair(): Promise<PkcePair> {
    return generatePkcePair();
  }

  /** Build a standard OAuth authorization URL using this client's base config. */
  authorizationUrl(options: BoundAuthorizationUrlOptions): string {
    return createAuthorizationUrl({
      loginUrl: this.loginUrl,
      clientId: this.clientId,
      ...options,
    });
  }

  /** Exchange a standard authorization code. */
  exchangeAuthorizationCode(
    options: BoundAuthorizationCodeOptions,
  ): Promise<SalesforceOAuthSession> {
    return exchangeAuthorizationCode({
      loginUrl: this.loginUrl,
      clientId: this.clientId,
      ...this.#requestDefaults,
      ...options,
    });
  }

  /** Exchange a Salesforce hybrid-app authorization code. */
  exchangeHybridAuthorizationCode(
    options: BoundAuthorizationCodeOptions,
  ): Promise<SalesforceOAuthSession> {
    return exchangeHybridAuthorizationCode({
      loginUrl: this.loginUrl,
      clientId: this.clientId,
      ...this.#requestDefaults,
      ...options,
    });
  }

  /** Refresh a standard OAuth session. */
  refreshToken(
    options: BoundRefreshTokenOptions,
  ): Promise<SalesforceOAuthSession> {
    return refreshAccessToken({
      loginUrl: this.loginUrl,
      clientId: this.clientId,
      ...this.#requestDefaults,
      ...options,
    });
  }

  /** Refresh a Salesforce hybrid-app session. */
  refreshHybridToken(
    options: BoundRefreshTokenOptions,
  ): Promise<SalesforceOAuthSession> {
    return refreshHybridAccessToken({
      loginUrl: this.loginUrl,
      clientId: this.clientId,
      ...this.#requestDefaults,
      ...options,
    });
  }

  /** Authenticate a server integration with the client-credentials flow. */
  clientCredentials(
    options: BoundClientCredentialsOptions,
  ): Promise<SalesforceOAuthSession> {
    return authenticateClientCredentials({
      loginUrl: this.loginUrl,
      clientId: this.clientId,
      ...this.#requestDefaults,
      ...options,
    });
  }

  /**
   * Authenticate the configured integration user with Salesforce JWT bearer.
   * The JWT assertion is created and exchanged in one call.
   */
  async jwtBearer(
    options: SalesforceJwtBearerOptions,
  ): Promise<SalesforceOAuthSession> {
    const assertionOptions: JwtBearerAssertionOptions = {
      loginUrl: this.loginUrl,
      clientId: this.clientId,
      username: options.username,
      privateKey: options.privateKey,
      ...(options.expiresInSeconds === undefined
        ? {}
        : { expiresInSeconds: options.expiresInSeconds }),
      ...(options.now === undefined ? {} : { now: options.now }),
    };
    const assertion = await createJwtBearerAssertion(assertionOptions);
    return authenticateJwtBearer({
      loginUrl: this.loginUrl,
      assertion,
      ...requestOptions(this.#requestDefaults, options),
    });
  }

  /** Create a private_key_jwt assertion for a later token request. */
  createClientAssertion(
    options: SalesforceClientAssertionOptions,
  ): Promise<string> {
    return createOAuthClientAssertion({
      loginUrl: this.loginUrl,
      clientId: this.clientId,
      ...options,
    });
  }

  /** Exchange a SAML 2.0 bearer assertion. */
  samlBearer(
    options: BoundSamlBearerOptions,
  ): Promise<SalesforceOAuthSession> {
    return authenticateSamlBearer({
      loginUrl: this.loginUrl,
      ...this.#requestDefaults,
      ...options,
    });
  }

  /** Exchange a Salesforce SAML assertion for API access. */
  samlAssertion(
    options: BoundSamlAssertionOptions,
  ): Promise<SalesforceOAuthSession> {
    return authenticateSamlAssertion({
      loginUrl: this.loginUrl,
      ...this.#requestDefaults,
      ...options,
    });
  }

  /** Exchange a supported subject token through Salesforce OAuth token exchange. */
  tokenExchange(
    options: BoundTokenExchangeOptions,
  ): Promise<SalesforceOAuthSession> {
    return exchangeToken({
      loginUrl: this.loginUrl,
      clientId: this.clientId,
      ...this.#requestDefaults,
      ...options,
    });
  }

  /** Start the device authorization flow. */
  requestDeviceAuthorization(
    options: BoundDeviceAuthorizationOptions = {},
  ): Promise<DeviceAuthorization> {
    return requestDeviceAuthorization({
      loginUrl: this.loginUrl,
      clientId: this.clientId,
      ...this.#requestDefaults,
      ...options,
    });
  }

  /** Perform one device-flow polling exchange. */
  pollDeviceAuthorization(
    options: BoundDeviceTokenOptions,
  ): Promise<SalesforceOAuthSession> {
    return pollDeviceAuthorization({
      loginUrl: this.loginUrl,
      clientId: this.clientId,
      ...this.#requestDefaults,
      ...options,
    });
  }

  /** Build an Experience Cloud Authorization Code and Credentials request. */
  codeCredentialsAuthorization(
    options: BoundCodeCredentialsAuthorizationOptions,
  ): HeadlessAuthorizationRequest {
    return createCodeCredentialsAuthorizationRequest({
      siteUrl: this.loginUrl,
      clientId: this.clientId,
      ...options,
    });
  }

  /** Build the Experience Cloud guest Code and Credentials request. */
  guestAuthorization(
    options: BoundHeadlessGuestAuthorizationOptions,
  ): HeadlessAuthorizationRequest {
    return createHeadlessGuestAuthorizationRequest({
      siteUrl: this.loginUrl,
      clientId: this.clientId,
      ...options,
    });
  }

  /** Call OAuth 2.0 for First-Party Applications authorization_challenge. */
  firstPartyAuthorizationChallenge(
    options: BoundFirstPartyAuthorizationChallengeOptions,
  ): Promise<FirstPartyAuthorizationChallenge> {
    return requestFirstPartyAuthorizationChallenge({
      siteUrl: this.loginUrl,
      ...this.#requestDefaults,
      ...options,
    });
  }

  /** Create a refresh-token-backed session manager bound to this client. */
  storedRefreshToken(
    options: BoundStoredRefreshTokenAuthOptions,
  ): StoredRefreshTokenAuth {
    return createStoredRefreshTokenAuth({
      loginUrl: this.loginUrl,
      clientId: this.clientId,
      ...this.#requestDefaults,
      ...options,
    });
  }
}
