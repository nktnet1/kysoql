/** Compile/typecheck fixture matching the quickstart's authentication helper. */
import { SalesforceAuth } from "@kysoql/auth";

const auth = new SalesforceAuth({
  loginUrl: "https://login.salesforce.com",
  clientId: "external-client-app-id",
});

export const getSalesforceSession = () =>
  auth.jwtBearer({
    username: "integration@example.com",
    privateKey: { type: "file", path: "./salesforce-auth-key.pem" },
  });
