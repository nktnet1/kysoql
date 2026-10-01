import { nonEmptySecret, nonEmptyText } from "#/validation";

/**
 * Minimal async store used to load and persist Salesforce refresh tokens.
 */
export interface RefreshTokenStore {
  /** Loads the currently persisted refresh token, if one exists. */
  getRefreshToken(): Promise<string | undefined>;
  /** Persists a refresh token, replacing any previous value. */
  setRefreshToken(token: string): Promise<void>;
  /** Deletes the persisted refresh token. */
  deleteRefreshToken(): Promise<void>;
}

/**
 * Subset of the Web Storage API required by the local-storage token store.
 */
export interface StorageLike {
  /** Reads a value from the backing Web Storage implementation. */
  getItem(key: string): string | null;
  /** Writes a value to the backing Web Storage implementation. */
  setItem(key: string, value: string): void;
  /** Removes a value from the backing Web Storage implementation. */
  removeItem(key: string): void;
}

/** Options for a refresh-token store backed by Web Storage. */
export interface LocalStorageRefreshTokenStoreOptions {
  /** Web Storage key used for the refresh token. */
  readonly key: string;
  /** Defaults to globalThis.localStorage when available. */
  readonly storage?: StorageLike;
}

/** Minimal Redis interface required by the Redis refresh-token store. */
export interface RedisLike {
  /** Reads a string value from Redis. */
  get(key: string): string | null | Promise<string | null>;
  /** Stores a string value in Redis. */
  set(key: string, value: string): unknown | Promise<unknown>;
  /** Deletes a key from Redis. */
  del(key: string): unknown | Promise<unknown>;
}

/** Options for a refresh-token store backed by Redis. */
export interface RedisRefreshTokenStoreOptions {
  /** Redis-compatible client used to persist the refresh token. */
  readonly client: RedisLike;
  /** Application-specific key suffix for the stored refresh token. */
  readonly key: string;
  /** Default: "kysoql:refresh-token:". */
  readonly prefix?: string;
}

const optionalStoredToken = (value: string | null): string | undefined =>
  value === null ? undefined : nonEmptySecret(value, "stored refresh token");

/**
 * Creates an in-memory refresh-token store for short-lived processes and
 * tests.
 */
export const createMemoryRefreshTokenStore = (
  initialRefreshToken?: string,
): RefreshTokenStore => {
  let token =
    initialRefreshToken === undefined
      ? undefined
      : nonEmptySecret(initialRefreshToken, "initialRefreshToken");
  return {
    getRefreshToken: async () => token,
    setRefreshToken: async (next) => {
      token = nonEmptySecret(next, "refresh token");
    },
    deleteRefreshToken: async () => {
      token = undefined;
    },
  };
};

/**
 * Creates a refresh-token store backed by a provided Web Storage
 * implementation.
 */
export const createLocalStorageRefreshTokenStore = (
  options: LocalStorageRefreshTokenStoreOptions,
): RefreshTokenStore => {
  const key = nonEmptyText(options.key, "key");
  const storage =
    options.storage ??
    (globalThis as typeof globalThis & { localStorage?: StorageLike })
      .localStorage;
  if (storage === undefined) {
    throw new TypeError(
      "localStorage is unavailable; provide a StorageLike implementation explicitly.",
    );
  }
  return {
    getRefreshToken: async () => optionalStoredToken(storage.getItem(key)),
    setRefreshToken: async (token) => {
      storage.setItem(key, nonEmptySecret(token, "refresh token"));
    },
    deleteRefreshToken: async () => {
      storage.removeItem(key);
    },
  };
};

/** Creates a refresh-token store backed by a Redis-compatible client. */
export const createRedisRefreshTokenStore = (
  options: RedisRefreshTokenStoreOptions,
): RefreshTokenStore => {
  const prefix = options.prefix ?? "kysoql:refresh-token:";
  const key = `${nonEmptyText(prefix, "prefix")}${nonEmptyText(
    options.key,
    "key",
  )}`;
  return {
    getRefreshToken: async () =>
      optionalStoredToken(await options.client.get(key)),
    setRefreshToken: async (token) => {
      await options.client.set(key, nonEmptySecret(token, "refresh token"));
    },
    deleteRefreshToken: async () => {
      await options.client.del(key);
    },
  };
};
