import {
  SalesforceResponseError,
  type SalesforceRestErrorDetail,
} from "#/errors";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const nonEmptySecret = (value: unknown, name: string): string => {
  if (typeof value !== "string" || !value.trim() || /[\r\n]/.test(value)) {
    throw new TypeError(`${name} must be a non-empty string without line breaks.`);
  }
  return value;
};

export const parseOrigin = (value: string, name: string): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${name} must be an HTTPS origin.`);
  }
  if (
    url.protocol !== "https:" || url.username || url.password ||
    url.pathname !== "/" || url.search || url.hash || value !== value.trim()
  ) {
    throw new TypeError(`${name} must be an HTTPS origin without credentials, paths, or query parameters.`);
  }
  return url.origin;
};

export const parseApiVersion = (value: string): string => {
  if (typeof value !== "string" || !/^[1-9]\d*\.0$/.test(value)) {
    throw new TypeError('apiVersion must be a Salesforce version such as "65.0", without "v".');
  }
  return value;
};

export const positiveInteger = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive safe integer.`);
  }
  return value;
};

export const parseBatchSize = (value: number | undefined): number | undefined => {
  if (value !== undefined && (!Number.isInteger(value) || value < 200 || value > 2000)) {
    throw new TypeError("batchSize must be an integer between 200 and 2000.");
  }
  return value;
};

export const parseTimeout = (value: number): number => {
  positiveInteger(value, "timeoutMs");
  if (value > 2_147_483_647) {
    throw new TypeError("timeoutMs must not exceed 2147483647.");
  }
  return value;
};

export const parseErrorDetails = (input: unknown): readonly SalesforceRestErrorDetail[] => {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((value: unknown) => {
    if (!isRecord(value) || typeof value.errorCode !== "string" || typeof value.message !== "string") {
      return [];
    }
    const fields = value.fields;
    return [{
      errorCode: value.errorCode,
      message: value.message,
      ...(Array.isArray(fields) && fields.every((field: unknown) => typeof field === "string")
        ? { fields: fields as string[] }
        : {}),
    }];
  });
};

export interface ParsedQueryPage {
  readonly done: boolean;
  readonly totalSize: number;
  readonly records: readonly Record<string, unknown>[];
  readonly nextRecordsUrl?: string;
}

export const parseQueryPage = (input: unknown): ParsedQueryPage => {
  if (
    !isRecord(input) || typeof input.done !== "boolean" ||
    !Number.isSafeInteger(input.totalSize) || (input.totalSize as number) < 0 ||
    !Array.isArray(input.records) || !input.records.every(isRecord) ||
    (input.nextRecordsUrl !== undefined && typeof input.nextRecordsUrl !== "string")
  ) {
    throw new SalesforceResponseError("Invalid Salesforce query-result envelope.");
  }
  if (!input.done && !input.nextRecordsUrl) {
    throw new SalesforceResponseError("Incomplete Salesforce query result without nextRecordsUrl.");
  }
  return {
    done: input.done,
    totalSize: input.totalSize as number,
    records: input.records,
    ...(input.nextRecordsUrl === undefined ? {} : { nextRecordsUrl: input.nextRecordsUrl as string }),
  };
};

export const parseCount = (input: unknown): number => {
  if (
    !isRecord(input) || input.done !== true ||
    !Number.isSafeInteger(input.totalSize) || (input.totalSize as number) < 0 ||
    (input.records !== undefined && input.records !== null &&
      (!Array.isArray(input.records) || input.records.length !== 0))
  ) {
    throw new SalesforceResponseError("Invalid or incomplete Salesforce COUNT() result.");
  }
  return input.totalSize as number;
};

/** Query locators are version-pinned, root-relative URLs, not arbitrary links. */
export const parseQueryLocator = (locator: string, apiVersion: string): string => {
  const prefix = `/services/data/v${apiVersion}/`;
  if (!locator.startsWith(prefix) || !/^(?:query|queryAll)\/[A-Za-z0-9_-]+$/.test(locator.slice(prefix.length))) {
    throw new SalesforceResponseError("Invalid or unsafe Salesforce nextRecordsUrl.");
  }
  return locator;
};
