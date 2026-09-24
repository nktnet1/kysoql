import type { AbortableQueryOptions } from "@kysoql/core";

import { SalesforceResponseError } from "#/errors";
import { parseTimeout } from "#/validation";

export interface RestRequestOptions extends AbortableQueryOptions {
  /** Combines with the client's signal; cancelling one operation does not cancel others. */
  readonly signal?: AbortSignal;
  /** Per HTTP request, including token acquisition and response body. Default: 30 seconds. */
  readonly timeoutMs?: number;
}

export interface HttpOptions extends RestRequestOptions {
  /** Native fetch by default. An injected implementation must honour signal and redirect. */
  readonly fetch?: typeof globalThis.fetch;
}

export const requestSignal = (
  defaults: RestRequestOptions,
  options: RestRequestOptions,
): AbortSignal => {
  const signals: AbortSignal[] = [
    AbortSignal.timeout(
      parseTimeout(options.timeoutMs ?? defaults.timeoutMs ?? 30_000),
    ),
  ];
  if (defaults.signal !== undefined) {
    signals.push(defaults.signal);
  }
  if (options.signal !== undefined) {
    signals.push(options.signal);
  }
  const signal = AbortSignal.any(signals);
  signal.throwIfAborted();
  return signal;
};

/** Cancel waiting without cancelling a token refresh shared by another request. */
export const waitFor = async <T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> => {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const aborted = (): void => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", aborted));
    // A thenable may settle while a caller is aborting; keep the check explicit.
    if (signal.aborted) {
      aborted();
    }
  });
};

export const readJson = async (
  response: Response,
  signal: AbortSignal,
): Promise<unknown> => {
  // Buffering JSON is intentional; the query executor streams pages, not bytes.
  const text = await waitFor(response.text(), signal);
  signal.throwIfAborted();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    if (!response.ok) {
      return undefined; // HTML/proxy errors still become a structured HTTP error.
    }
    throw new SalesforceResponseError("Salesforce returned invalid JSON.");
  }
};
