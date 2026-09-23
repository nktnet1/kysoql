export { SalesforceOAuthError, SalesforceOAuthResponseError } from "#/errors";
export type { OAuthRequestOptions } from "#/http";
export {
  type CodeCredentialsAuthorizationOptions,
  type CodeCredentialsNamedUserOptions,
  type CodeCredentialsUserDiscoveryOptions,
  createCodeCredentialsAuthorizationRequest,
  type FirstPartyAuthorizationChallenge,
  type FirstPartyAuthorizationChallengeOptions,
  type FirstPartyAuthorizationValue,
  type HeadlessAuthorizationRequest,
  createHeadlessGuestAuthorizationRequest,
  type HeadlessGuestAuthorizationOptions,
  requestFirstPartyAuthorizationChallenge,
} from "#/headless";
export {
  createOAuthClientAssertion,
  createJwtBearerAssertion,
  type JwtBearerAssertionOptions,
  type OAuthClientAssertionOptions,
} from "#/jwt";
export {
  type AccessTokenProvider,
  type AccessTokenRequest,
  type ClientAssertionProvider,
  createStoredRefreshTokenAuth,
  type StoredRefreshTokenAuth,
  type StoredRefreshTokenAuthOptions,
} from "#/manager";
export {
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
  type JwtBearerOptions,
  pollDeviceAuthorization,
  type RefreshTokenOptions,
  refreshAccessToken,
  refreshHybridAccessToken,
  requestDeviceAuthorization,
  type SalesforceOAuthSession,
  type SamlAssertionOptions,
  type SamlBearerOptions,
  type TokenExchangeOptions,
  type TokenExchangeSubjectTokenType,
} from "#/oauth";
export { createPkceChallenge, generatePkcePair, type PkcePair } from "#/pkce";
export {
  SalesforceAuth,
  type SalesforceAuthOptions,
  type SalesforceClientAssertionOptions,
  type SalesforceJwtBearerOptions,
} from "#/salesforce-auth";
export {
  createLocalStorageRefreshTokenStore,
  createMemoryRefreshTokenStore,
  createRedisRefreshTokenStore,
  type LocalStorageRefreshTokenStoreOptions,
  type RedisLike,
  type RedisRefreshTokenStoreOptions,
  type RefreshTokenStore,
  type StorageLike,
} from "#/storage";
