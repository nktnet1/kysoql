export {
  type AccessTokenProvider,
  createRestClient,
  DEFAULT_API_VERSION,
  type RestClient,
  type RestClientOptions,
  type RestGetOptions,
} from "#src/client";
export {
  SalesforceOAuthError,
  SalesforceQueryLimitError,
  SalesforceResponseError,
  SalesforceRestError,
  type SalesforceRestErrorDetail,
} from "#src/errors";
export {
  createRestExecutor,
  type RestExecutor,
  type RestPaginationOptions,
  type RestQueryOptions,
  type RestQueryPage,
} from "#src/executor";
export type { HttpOptions, RestRequestOptions } from "#src/http";
export {
  authenticateClientCredentials,
  type ClientCredentialsOptions,
  type RefreshTokenOptions,
  refreshAccessToken,
  type SalesforceOAuthSession,
} from "#src/oauth";
