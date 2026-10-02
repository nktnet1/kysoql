# @kysoql/auth

`@kysoql/auth` handles Salesforce OAuth for applications that use Kysoql. It provides a `SalesforceAuth` client for supported Salesforce flows plus optional refresh-token storage for memory, browser `localStorage`, Redis, or your own store.

For a typical server-to-server integration, start with JWT bearer authentication and `@kysoql/rest`.

## Install

```bash
pnpm add @kysoql/auth @kysoql/core @kysoql/rest
```

## Server-to-server with JWT bearer

Bind the Salesforce login URL and client ID once, then request a session with a private key:

```ts
import { SalesforceAuth } from "@kysoql/auth";

const auth = new SalesforceAuth({
  loginUrl: "https://login.salesforce.com",
  clientId: "external-client-app-id",
});

const session = await auth.jwtBearer({
  username: "integration@example.com",
  privateKey: { type: "file", path: "./salesforce-auth-key.pem" },
});
```

Private keys use an explicit source so a string is never guessed to be a file path or PEM content:

```ts
{ type: "file", path: "./salesforce-auth-key.pem" }
{ type: "pem", value: process.env.SALESFORCE_PRIVATE_KEY! }
{ type: "crypto-key", key }
```

JWT bearer does not issue a refresh token. When an access token expires, perform another JWT exchange.

The REST executor can do that through an access-token provider:

```ts
import { createRestExecutor } from "@kysoql/rest";

let session = await auth.jwtBearer({
  username: "integration@example.com",
  privateKey: { type: "file", path: "./salesforce-auth-key.pem" },
});

const instanceUrl = session.instanceUrl;

const executor = createRestExecutor({
  instanceUrl,
  accessToken: async ({ refresh }) => {
    if (refresh) {
      session = await auth.jwtBearer({
        username: "integration@example.com",
        privateKey: { type: "file", path: "./salesforce-auth-key.pem" },
      });
    }

    return session.accessToken;
  },
});
```

## Refresh-token sessions

For flows that return refresh tokens, use a storage adapter so token rotation is not lost:

```ts
import {
  createRedisRefreshTokenStore,
  SalesforceAuth,
  type RedisLike,
} from "@kysoql/auth";

export async function createSessionAuth(
  client: RedisLike,
  initialRefreshToken: string,
) {
  const auth = new SalesforceAuth({
    loginUrl: "https://example.my.salesforce.com",
    clientId: "external-client-app-id",
  });

  return auth.storedRefreshToken({
    initialRefreshToken,
    refreshTokenStore: createRedisRefreshTokenStore({
      client,
      key: "salesforce:integration-user",
    }),
  });
}
```

If Salesforce rotates the refresh token, Kysoql stores the replacement before exposing the new session. Access tokens are not written to refresh-token stores.

For browser applications, `createLocalStorageRefreshTokenStore()` is available when your threat model explicitly allows JavaScript-readable token persistence. A server-side store is usually the better choice when your architecture supports one.

## Supported flows

Kysoql supports the Salesforce authentication flows documented in the [authentication flow guide](https://nktnet1.github.io/kysoql/docs/auth/flows), including:

- JWT bearer
- web-server authorization code with PKCE
- refresh token
- client credentials
- `private_key_jwt` client authentication
- SAML bearer and Salesforce SAML assertion flows
- OAuth token exchange
- device flow
- hybrid web-server and hybrid refresh flows
- Experience Cloud headless identity flows
- OAuth 2.0 for First-Party Applications flows

Salesforce's retiring username-password, user-agent, and hybrid user-agent flows are not implemented.

## Documentation

- [Authentication overview](https://nktnet1.github.io/kysoql/docs/auth)
- [Choose an authentication flow](https://nktnet1.github.io/kysoql/docs/auth/flows)
- [JWT bearer](https://nktnet1.github.io/kysoql/docs/auth/flows/jwt-bearer)
- [Refresh-token storage](https://nktnet1.github.io/kysoql/docs/auth/storage)
- [REST authentication](https://nktnet1.github.io/kysoql/docs/rest/authentication)
- [API reference](https://nktnet1.github.io/kysoql/docs/auth/api)
