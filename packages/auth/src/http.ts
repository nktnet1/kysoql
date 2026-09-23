import { SalesforceOAuthResponseError } from "#/errors";
import { parseTimeout } from "#/validation";

export interface OAuthRequestOptions {
  /** Cancels this request. */
  readonly signal?: AbortSignal;
  /** Per HTTP request. Default: 30 seconds. */
  readonly timeoutMs?: number;
  /**
   * Native fetch by default. Primarily useful for tests and custom runtimes.
   */
  readonly fetch?: typeof globalThis.fetch;
}

export const requestSignal = (options: OAuthRequestOptions): AbortSignal => {
  const signals: AbortSignal[] = [
    AbortSignal.timeout(parseTimeout(options.timeoutMs ?? 30_000)),
  ];
  if (options.signal !== undefined) {
    signals.push(options.signal);
  }
  const signal = AbortSignal.any(signals);
  signal.throwIfAborted();
  return signal;
};

const waitFor = async <T>(
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
    if (signal.aborted) {
      aborted();
    }
  });
};

export const readJson = async (
  response: Response,
  signal: AbortSignal,
): Promise<unknown> => {
  const text = await waitFor(response.text(), signal);
  signal.throwIfAborted();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    if (!response.ok) {
      return undefined;
    }
    throw new SalesforceOAuthResponseError("Salesforce returned invalid JSON.");
  }
};
