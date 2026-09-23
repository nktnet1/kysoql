# @kysoql/auth

Salesforce authentication helpers for applications that execute SOQL through
`@kysoql/rest`. The package covers supported Salesforce OAuth/token flows and
provides opt-in refresh-token stores for memory, browser `localStorage`, Redis,
or a custom backend.

## Install

```sh
pnpm add @kysoql/auth @kysoql/rest @kysoql/core
```

## Default: server-to-server with a private key

For a server-to-server integration that can protect a private key, start with
Salesforce OAuth 2.0 JWT bearer authentication.

Salesforce reference: [OAuth 2.0 JWT Bearer Flow for Server-to-Server Integration](https://help.salesforce.com/s/articleView?id=xcloud.remoteaccess_oauth_jwt_flow_ca.htm&language=en_US&type=5).

```ts
import {
  authenticateJwtBearer,
  createJwtBearerAssertion,
} from "@kysoql/auth";
import { createRestExecutor } from "@kysoql/rest";

export async function createExecutor(privateKey: CryptoKey) {
  const loginUrl = "https://login.salesforce.com";
  const assertion = await createJwtBearerAssertion({
    clientId: "external-client-app-id",
    username: "integration@example.com",
    loginUrl,
    privateKey,
  });
  const session = await authenticateJwtBearer({ loginUrl, assertion });

  return createRestExecutor({
    instanceUrl: session.instanceUrl,
    accessToken: session.accessToken,
  });
}
```

JWT bearer does not issue a refresh token. Mint and exchange another short-lived
assertion when a new access token is required.

## Refresh tokens

Flows that issue refresh tokens can persist rotation through a storage adapter:

```ts
import {
  createRedisRefreshTokenStore,
  createStoredRefreshTokenAuth,
  type RedisLike,
} from "@kysoql/auth";
import { createRestExecutor } from "@kysoql/rest";

export async function createRefreshingExecutor(
  client: RedisLike,
  initialRefreshToken: string,
) {
  const store = createRedisRefreshTokenStore({
    client,
    key: "salesforce:integration-user",
  });
  const auth = createStoredRefreshTokenAuth({
    loginUrl: "https://example.my.salesforce.com",
    clientId: "external-client-app-id",
    initialRefreshToken,
    refreshTokenStore: store,
  });
  const session = await auth.getSession();

  return createRestExecutor({
    instanceUrl: session.instanceUrl,
    accessToken: auth.accessTokenProvider,
  });
}
```

`createLocalStorageRefreshTokenStore()` is available for browser applications
that deliberately accept JavaScript-readable browser persistence. Prefer a
server-side store when the architecture permits it. Access tokens are never
written to refresh-token stores by this package.

Salesforce refresh reference: [OAuth 2.0 Refresh Token Flow for Renewed Sessions](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_refresh_token_flow.htm&language=en_US&type=5).

## Supported flows

The end-user documentation keeps each authentication method on its own page:

- [JWT bearer](../../apps/docs/content/docs/auth/jwt-bearer.mdx)
- [web-server authorization code with PKCE](../../apps/docs/content/docs/auth/web-server-pkce.mdx)
- [refresh token](../../apps/docs/content/docs/auth/refresh-token.mdx)
- [client credentials](../../apps/docs/content/docs/auth/client-credentials.mdx)
- [`private_key_jwt` client authentication](../../apps/docs/content/docs/auth/private-key-jwt.mdx)
- [SAML bearer assertion](../../apps/docs/content/docs/auth/saml-bearer.mdx)
- [Salesforce SAML assertion](../../apps/docs/content/docs/auth/saml-assertion.mdx)
- [OAuth token exchange](../../apps/docs/content/docs/auth/token-exchange.mdx)
- [device flow](../../apps/docs/content/docs/auth/device.mdx)
- [hybrid web-server](../../apps/docs/content/docs/auth/hybrid-web-server.mdx)
- [hybrid refresh token](../../apps/docs/content/docs/auth/hybrid-refresh-token.mdx)
- [Experience Cloud Code and Credentials](../../apps/docs/content/docs/auth/experience-cloud-code-credentials.mdx)
- [Experience Cloud guest authorization](../../apps/docs/content/docs/auth/experience-cloud-guest.mdx)
- [OAuth 2.0 for First-Party Applications](../../apps/docs/content/docs/auth/first-party-applications.mdx)
  - [username-password](../../apps/docs/content/docs/auth/first-party-username-password.mdx)
  - [passwordless login](../../apps/docs/content/docs/auth/first-party-passwordless.mdx)
  - [registration](../../apps/docs/content/docs/auth/first-party-registration.mdx)

Salesforce reference: [OAuth Authorization Flows](https://help.salesforce.com/s/articleView?id=remoteaccess_oauth_flows.htm&language=en_US&type=5).

Salesforce's retiring username-password, user-agent, and hybrid user-agent flows
are intentionally not implemented. Asset tokens are device identity tokens, not
general bearer sessions for SOQL REST calls.
