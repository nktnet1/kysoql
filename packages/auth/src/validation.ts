export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const nonEmptySecret = (value: unknown, name: string): string => {
  if (typeof value !== "string" || !value.trim() || /[\r\n]/.test(value)) {
    throw new TypeError(
      `${name} must be a non-empty string without line breaks.`,
    );
  }
  return value;
};

export const nonEmptyText = (value: unknown, name: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string.`);
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
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    value !== value.trim()
  ) {
    throw new TypeError(
      `${name} must be an HTTPS origin without credentials, paths, or query parameters.`,
    );
  }
  return url.origin;
};

/**
 * Salesforce OAuth endpoints can be hosted either at an org/login origin or
 * under an Experience Cloud site path. Preserve that path while rejecting URL
 * components that would change where fixed OAuth endpoint suffixes are sent.
 */
export const parseOAuthBaseUrl = (value: string, name: string): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${name} must be an HTTPS Salesforce base URL.`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    value !== value.trim()
  ) {
    throw new TypeError(
      `${name} must be an HTTPS Salesforce base URL without credentials, query parameters, or a fragment.`,
    );
  }
  const pathname = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${pathname === "/" ? "" : pathname}`;
};

export const parseAbsoluteRedirectUri = (value: string): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("redirectUri must be an absolute URL.");
  }
  const loopback =
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]" ||
      url.hostname === "localhost");
  if (
    (url.protocol !== "https:" && !loopback) ||
    url.username ||
    url.password
  ) {
    throw new TypeError(
      "redirectUri must use HTTPS, except for an HTTP loopback callback.",
    );
  }
  return url.href;
};

export const parseTimeout = (value: number): number => {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2_147_483_647) {
    throw new TypeError(
      "timeoutMs must be a positive safe integer not exceeding 2147483647.",
    );
  }
  return value;
};

export const parseScope = (
  value: string | readonly string[] | undefined,
): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const scopes = typeof value === "string" ? value.split(/\s+/) : value;
  const normalized = scopes.map((scope) => nonEmptyText(scope, "scope"));
  if (normalized.length === 0) {
    throw new TypeError("scope must contain at least one value.");
  }
  return normalized.join(" ");
};
