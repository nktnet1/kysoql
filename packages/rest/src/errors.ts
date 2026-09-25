/** Structured error detail returned by Salesforce REST endpoints. */
export interface SalesforceRestErrorDetail {
  /** Salesforce REST error code, such as `INVALID_SESSION_ID`. */
  readonly errorCode: string;
  /** Human-readable error message returned by Salesforce. */
  readonly message: string;
  /** Field API names associated with the error, when supplied. */
  readonly fields?: readonly string[];
}

/** Structured API errors. Details may contain org data; do not log them blindly. */
export class SalesforceRestError extends Error {
  /** HTTP status returned by Salesforce. */
  readonly status: number;
  /** Validated Salesforce error details returned in the response body. */
  readonly errors: readonly SalesforceRestErrorDetail[];

  /** Creates an error from a Salesforce REST status and validated error details. */
  constructor(status: number, errors: readonly SalesforceRestErrorDetail[]) {
    // Do not put the URL, SOQL, credentials, or server message in the default log.
    super(`Salesforce REST request failed (HTTP ${status}).`);
    this.name = "SalesforceRestError";
    this.status = status;
    this.errors = errors;
  }
}

/** Thrown when Salesforce returns a response that cannot be validated. */
export class SalesforceResponseError extends Error {
  /** Creates an error for a malformed or inconsistent Salesforce REST response. */
  constructor(message: string) {
    super(message);
    this.name = "SalesforceResponseError";
  }
}

/**
 * Thrown when configured pagination limits are exceeded before a query
 * completes.
 */
export class SalesforceQueryLimitError extends Error {
  /** Configured safety limit that was exceeded. */
  readonly limit: "maxPages" | "maxRecords";

  /** Creates an error indicating a configured query safety limit was exceeded. */
  constructor(limit: "maxPages" | "maxRecords") {
    super(
      `Salesforce query exceeded ${limit}; results were not truncated to success.`,
    );
    this.name = "SalesforceQueryLimitError";
    this.limit = limit;
  }
}

/** Thrown when a Salesforce OAuth token request fails. */
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
