import { SalesforceRestError } from "#/errors";
import {
  type HttpOptions,
  readJson,
  type RestRequestOptions,
  requestSignal,
  waitFor,
} from "#/http";
import {
  nonEmptySecret,
  parseApiVersion,
  parseBatchSize,
  parseErrorDetails,
  parseOrigin,
  parseTimeout,
} from "#/validation";

/** Deliberately pinned, not auto-upgraded when Salesforce publishes a release. */
export const DEFAULT_API_VERSION = "65.0";

export type AccessTokenProvider = (context: {
  readonly refresh: boolean;
}) => string | Promise<string>;

export interface RestClientOptions extends HttpOptions {
  readonly instanceUrl: string;
  /** Provider is called lazily, then again only after INVALID_SESSION_ID. */
  readonly accessToken: string | AccessTokenProvider;
  readonly apiVersion?: string;
}

export interface RestGetOptions extends RestRequestOptions {
  readonly batchSize?: number;
}

export interface RestClient {
  readonly apiVersion: string;
  /** GET a version-relative API path or a same-version /services/data/ path. */
  request(path: string, options?: RestGetOptions): Promise<unknown>;
}

class NativeRestClient implements RestClient {
  readonly apiVersion: string;
  readonly #origin: string;
  readonly #prefix: string;
  readonly #options: RestClientOptions;
  readonly #fetch: typeof globalThis.fetch;
  #token: string | undefined;
  #loading: Promise<string> | undefined;

  constructor(options: RestClientOptions) {
    this.#origin = parseOrigin(options.instanceUrl, "instanceUrl");
    this.apiVersion = parseApiVersion(options.apiVersion ?? DEFAULT_API_VERSION);
    this.#prefix = `/services/data/v${this.apiVersion}`;
    this.#options = { ...options };
    this.#fetch = options.fetch ?? globalThis.fetch;
    parseTimeout(options.timeoutMs ?? 30_000);
    if (typeof this.#fetch !== "function") {
      throw new TypeError("Native fetch or an injected fetch implementation is required.");
    }
    if (typeof options.accessToken !== "function") {
      this.#token = nonEmptySecret(options.accessToken, "accessToken");
    }
  }

  #url(path: string): URL {
    if (!path.startsWith("/") || path.startsWith("//") || /[\\\r\n#]/.test(path)) {
      throw new TypeError("REST paths must be relative API paths, not absolute URLs.");
    }
    const url = new URL(
      path.startsWith("/services/data/") ? path : `${this.#prefix}${path}`,
      this.#origin,
    );
    // Normalisation must never permit traversal, credentials, or a version switch.
    if (url.origin !== this.#origin || !url.pathname.startsWith(`${this.#prefix}/`)) {
      throw new TypeError("REST path escapes the configured API version.");
    }
    if (/%(?:25)*(?:2e|2f|5c)/i.test(url.pathname)) {
      throw new TypeError("REST path contains encoded traversal.");
    }
    const decoded = decodeURIComponent(url.pathname);
    if (decoded.split("/").some((part) => part === "." || part === "..") || decoded.includes("\\")) {
      throw new TypeError("REST path contains unsafe traversal.");
    }
    return url;
  }

  #accessToken(rejectedToken?: string): Promise<string> {
    if (this.#token !== undefined && this.#token !== rejectedToken) {
      return Promise.resolve(this.#token);
    }
    if (this.#loading !== undefined) {
      return this.#loading;
    }
    const provider = this.#options.accessToken;
    if (typeof provider !== "function") {
      return Promise.resolve(nonEmptySecret(provider, "accessToken"));
    }
    const loading = Promise.resolve()
      .then(() => provider({ refresh: rejectedToken !== undefined }))
      .then((token) => {
        this.#token = nonEmptySecret(token, "Access token provider result");
        return this.#token;
      });
    this.#loading = loading;
    // Release both successful and failed loads; don't retain a rejected promise.
    void loading.then(
      () => { this.#loading = undefined; },
      () => { this.#loading = undefined; },
    );
    return loading;
  }

  async request(path: string, options: RestGetOptions = {}): Promise<unknown> {
    const url = this.#url(path);
    const batchSize = parseBatchSize(options.batchSize);
    const signal = requestSignal(this.#options, options);
    let token = await waitFor(this.#accessToken(), signal);
    for (let attempt = 0; attempt < 2; attempt++) {
      signal.throwIfAborted();
      const response = await this.#fetch(url, {
        method: "GET",
        redirect: "error",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(batchSize === undefined ? {} : { "Sforce-Query-Options": `batchSize=${batchSize}` }),
        },
        signal,
      });
      const body = await readJson(response, signal);
      if (response.ok) {
        return body;
      }
      const details = parseErrorDetails(body);
      if (
        attempt === 0 && response.status === 401 &&
        typeof this.#options.accessToken === "function" &&
        details.some((detail) => detail.errorCode === "INVALID_SESSION_ID")
      ) {
        token = await waitFor(this.#accessToken(token), signal);
        continue;
      }
      throw new SalesforceRestError(response.status, details);
    }
    throw new Error("Unreachable REST retry state.");
  }
}

export const createRestClient = (options: RestClientOptions): RestClient =>
  new NativeRestClient(options);

export const resolveRestClient = (input: RestClient | RestClientOptions): RestClient =>
  "request" in input ? input : createRestClient(input);
