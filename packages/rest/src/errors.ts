export interface SalesforceRestErrorDetail {
  readonly errorCode: string;
  readonly message: string;
  readonly fields?: readonly string[];
}

/** Structured API errors. Details may contain org data; do not log them blindly. */
export class SalesforceRestError extends Error {
  readonly status: number;
  readonly errors: readonly SalesforceRestErrorDetail[];

  constructor(status: number, errors: readonly SalesforceRestErrorDetail[]) {
    // Do not put the URL, SOQL, credentials, or server message in the default log.
    super(`Salesforce REST request failed (HTTP ${status}).`);
    this.name = "SalesforceRestError";
    this.status = status;
    this.errors = errors;
  }
}

export class SalesforceResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalesforceResponseError";
  }
}

export class SalesforceQueryLimitError extends Error {
  readonly limit: "maxPages" | "maxRecords";

  constructor(limit: "maxPages" | "maxRecords") {
    super(
      `Salesforce query exceeded ${limit}; results were not truncated to success.`,
    );
    this.name = "SalesforceQueryLimitError";
    this.limit = limit;
  }
}

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
