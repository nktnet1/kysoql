import { nonEmptySecret, nonEmptyText } from "#/validation";

export interface RefreshTokenStore {
  getRefreshToken(): Promise<string | undefined>;
  setRefreshToken(token: string): Promise<void>;
  deleteRefreshToken(): Promise<void>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LocalStorageRefreshTokenStoreOptions {
  readonly key: string;
  /** Defaults to globalThis.localStorage when available. */
  readonly storage?: StorageLike;
}

export interface RedisLike {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string): unknown | Promise<unknown>;
  del(key: string): unknown | Promise<unknown>;
}

export interface RedisRefreshTokenStoreOptions {
  readonly client: RedisLike;
  readonly key: string;
  /** Default: "kysoql:refresh-token:". */
  readonly prefix?: string;
}

const optionalStoredToken = (value: string | null): string | undefined =>
  value === null ? undefined : nonEmptySecret(value, "stored refresh token");

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
