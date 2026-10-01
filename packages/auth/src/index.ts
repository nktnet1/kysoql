export {
  SalesforceOAuthError,
  SalesforceOAuthResponseError,
} from "#src/errors";
export {
  type CodeCredentialsAuthorizationOptions,
  type CodeCredentialsNamedUserOptions,
  type CodeCredentialsUserDiscoveryOptions,
  createCodeCredentialsAuthorizationRequest,
  createHeadlessGuestAuthorizationRequest,
  type FirstPartyAuthorizationChallenge,
  type FirstPartyAuthorizationChallengeOptions,
  type FirstPartyAuthorizationValue,
  type HeadlessAuthorizationRequest,
  type HeadlessGuestAuthorizationOptions,
  requestFirstPartyAuthorizationChallenge,
} from "#src/headless";
export type { OAuthRequestOptions } from "#src/http";
export {
  createJwtBearerAssertion,
  createOAuthClientAssertion,
  type JwtBearerAssertionOptions,
  type OAuthClientAssertionOptions,
  type PrivateKeyInput,
} from "#src/jwt";
export {
  type AccessTokenProvider,
  type AccessTokenRequest,
  type ClientAssertionProvider,
  createStoredRefreshTokenAuth,
  type StoredRefreshTokenAuth,
  type StoredRefreshTokenAuthOptions,
} from "#src/manager";
export {
  type AuthorizationCodeOptions,
  type AuthorizationUrlOptions,
  authenticateClientCredentials,
  authenticateJwtBearer,
  authenticateSamlAssertion,
  authenticateSamlBearer,
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
} from "#src/oauth";
export {
  createPkceChallenge,
  generatePkcePair,
  type PkcePair,
} from "#src/pkce";
export {
  SalesforceAuth,
  type SalesforceAuthOptions,
  type SalesforceClientAssertionOptions,
  type SalesforceJwtBearerOptions,
} from "#src/salesforce-auth";
export {
  createLocalStorageRefreshTokenStore,
  createMemoryRefreshTokenStore,
  createRedisRefreshTokenStore,
  type LocalStorageRefreshTokenStoreOptions,
  type RedisLike,
  type RedisRefreshTokenStoreOptions,
  type RefreshTokenStore,
  type StorageLike,
} from "#src/storage";
