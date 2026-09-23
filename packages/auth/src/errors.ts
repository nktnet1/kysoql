/**
 * OAuth endpoint rejection without credential-bearing server descriptions in
 * the message.
 */
export class SalesforceOAuthError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code?: string) {
    super(`Salesforce OAuth request failed (HTTP ${status}).`);
    this.name = "SalesforceOAuthError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Salesforce returned a successful response that does not match the documented
 * contract.
 */
export class SalesforceOAuthResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalesforceOAuthResponseError";
  }
}
