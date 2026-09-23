# @kysoql/auth

Salesforce authentication for applications that execute SOQL through
`@kysoql/rest`. `SalesforceAuth` is the primary application-facing API: bind the
Salesforce URL and client ID once, then use flow methods. Lower-level functions
remain available for custom composition. The package also provides opt-in
refresh-token stores for memory, browser `localStorage`, Redis, or a custom
backend.

## Install

```sh
pnpm add @kysoql/auth @kysoql/rest @kysoql/core
```

## Default: server-to-server with a private key

For a server-to-server integration that can protect a private key, start with
Salesforce OAuth 2.0 JWT bearer authentication.

Salesforce reference: [OAuth 2.0 JWT Bearer Flow for Server-to-Server Integration](https://help.salesforce.com/s/articleView?id=xcloud.remoteaccess_oauth_jwt_flow_ca.htm&language=en_US&type=5).

```ts
import { SalesforceAuth } from "@kysoql/auth";
import { createRestExecutor } from "@kysoql/rest";

const auth = new SalesforceAuth({
  loginUrl: "https://login.salesforce.com",
  clientId: "external-client-app-id",
});

export async function createExecutor() {
  let session = await auth.jwtBearer({
    username: "integration@example.com",
    privateKey: { type: "file", path: "./salesforce-auth-key.pem" },
  });
  const instanceUrl = session.instanceUrl;

  return createRestExecutor({
    instanceUrl,
    accessToken: async ({ refresh }) => {
      if (refresh) {
        const next = await auth.jwtBearer({
          username: "integration@example.com",
          privateKey: { type: "file", path: "./salesforce-auth-key.pem" },
        });
        if (next.instanceUrl !== instanceUrl) {
          throw new Error("Salesforce instance changed; recreate the REST client.");
        }
        session = next;
      }
      return session.accessToken;
    },
  });
}
```

`privateKey` is explicit: use `{ type: "file", path }`,
`{ type: "pem", value }`, or `{ type: "crypto-key", key }`. JWT bearer does not
issue a refresh token. The REST client caches the provider's access token in
memory and calls it again only after `401 INVALID_SESSION_ID`, at which point the
example performs another JWT exchange.

## Refresh tokens

Flows that issue refresh tokens can persist rotation through a storage adapter:

```ts
import {
  createRedisRefreshTokenStore,
  SalesforceAuth,
  type RedisLike,
} from "@kysoql/auth";
import { createRestExecutor } from "@kysoql/rest";

export async function createRefreshingExecutor(
  client: RedisLike,
  initialRefreshToken: string,
) {
  const auth = new SalesforceAuth({
    loginUrl: "https://example.my.salesforce.com",
    clientId: "external-client-app-id",
  });
  const store = createRedisRefreshTokenStore({
    client,
    key: "salesforce:integration-user",
  });
  const sessionAuth = auth.storedRefreshToken({
    initialRefreshToken,
    refreshTokenStore: store,
  });
  const session = await sessionAuth.getSession();

  return createRestExecutor({
    instanceUrl: session.instanceUrl,
    accessToken: sessionAuth.accessTokenProvider,
  });
}
```

`createLocalStorageRefreshTokenStore()` is available for browser applications
that deliberately accept JavaScript-readable browser persistence. Prefer a
server-side store when the architecture permits it. Access tokens are never
written to refresh-token stores by this package.

Salesforce refresh reference: [OAuth 2.0 Refresh Token Flow for Renewed Sessions](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_refresh_token_flow.htm&language=en_US&type=5).

## Supported flows

The end-user documentation keeps each authentication method in the nested
`Authentication flows` section:

- [JWT bearer](../../apps/docs/content/docs/auth/flows/jwt-bearer.mdx)
- [web-server authorization code with PKCE](../../apps/docs/content/docs/auth/flows/web-server-pkce.mdx)
- [refresh token](../../apps/docs/content/docs/auth/flows/refresh-token.mdx)
- [client credentials](../../apps/docs/content/docs/auth/flows/client-credentials.mdx)
- [`private_key_jwt` client authentication](../../apps/docs/content/docs/auth/flows/private-key-jwt.mdx)
- [SAML bearer assertion](../../apps/docs/content/docs/auth/flows/saml-bearer.mdx)
- [Salesforce SAML assertion](../../apps/docs/content/docs/auth/flows/saml-assertion.mdx)
- [OAuth token exchange](../../apps/docs/content/docs/auth/flows/token-exchange.mdx)
- [device flow](../../apps/docs/content/docs/auth/flows/device.mdx)
- [hybrid web-server](../../apps/docs/content/docs/auth/flows/hybrid-web-server.mdx)
- [hybrid refresh token](../../apps/docs/content/docs/auth/flows/hybrid-refresh-token.mdx)
- [Experience Cloud Code and Credentials](../../apps/docs/content/docs/auth/flows/experience-cloud-code-credentials.mdx)
- [Experience Cloud guest authorization](../../apps/docs/content/docs/auth/flows/experience-cloud-guest.mdx)
- [OAuth 2.0 for First-Party Applications](../../apps/docs/content/docs/auth/flows/first-party-applications.mdx)
  - [username-password](../../apps/docs/content/docs/auth/flows/first-party-username-password.mdx)
  - [passwordless login](../../apps/docs/content/docs/auth/flows/first-party-passwordless.mdx)
  - [registration](../../apps/docs/content/docs/auth/flows/first-party-registration.mdx)

Salesforce reference: [OAuth Authorization Flows](https://help.salesforce.com/s/articleView?id=remoteaccess_oauth_flows.htm&language=en_US&type=5).

Salesforce's retiring username-password, user-agent, and hybrid user-agent flows
are intentionally not implemented. Asset tokens are device identity tokens, not
general bearer sessions for SOQL REST calls.
