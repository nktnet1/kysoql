export {
  type AccessTokenProvider,
  createRestClient,
  DEFAULT_API_VERSION,
  type RestClient,
  type RestClientOptions,
  type RestGetOptions,
} from "#/client";
export {
  SalesforceOAuthError,
  SalesforceQueryLimitError,
  SalesforceResponseError,
  SalesforceRestError,
  type SalesforceRestErrorDetail,
} from "#/errors";
export {
  createRestExecutor,
  type RestExecutor,
  type RestPaginationOptions,
  type RestQueryOptions,
  type RestQueryPage,
} from "#/executor";
export type { HttpOptions, RestRequestOptions } from "#/http";
export {
  authenticateClientCredentials,
  type ClientCredentialsOptions,
  refreshAccessToken,
  type RefreshTokenOptions,
  type SalesforceOAuthSession,
} from "#/oauth";
