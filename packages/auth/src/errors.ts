/**
 * OAuth endpoint rejection without credential-bearing server descriptions in
 * the message.
 */
export class SalesforceOAuthError extends Error {
  /** HTTP status associated with this Salesforce error. */
  readonly status: number;
  /** OAuth error code returned by Salesforce. */
  readonly code: string | undefined;

  /** Creates an OAuth error from a Salesforce HTTP status and OAuth error code. */
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
  /** Creates an error for a malformed Salesforce OAuth response. */
  constructor(message: string) {
    super(message);
    this.name = "SalesforceOAuthResponseError";
  }
}
