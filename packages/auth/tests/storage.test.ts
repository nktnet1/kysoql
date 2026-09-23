import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  createLocalStorageRefreshTokenStore,
  createMemoryRefreshTokenStore,
  createRedisRefreshTokenStore,
} from "#/index";

describe("refresh-token stores", () => {
  it("stores tokens in memory", async () => {
    const store = createMemoryRefreshTokenStore("initial");
    assert.equal(await store.getRefreshToken(), "initial");
    await store.setRefreshToken("next");
    assert.equal(await store.getRefreshToken(), "next");
    await store.deleteRefreshToken();
    assert.equal(await store.getRefreshToken(), undefined);
  });

  it("uses a supplied localStorage-compatible object", async () => {
    const values = new Map<string, string>();
    const store = createLocalStorageRefreshTokenStore({
      key: "sf.refresh",
      storage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => {
          values.delete(key);
        },
      },
    });
    await store.setRefreshToken("refresh");
    assert.equal(values.get("sf.refresh"), "refresh");
    assert.equal(await store.getRefreshToken(), "refresh");
    await store.deleteRefreshToken();
    assert.equal(values.has("sf.refresh"), false);
  });

  it("uses Redis-compatible get/set/del methods with a namespaced key", async () => {
    const values = new Map<string, string>();
    const calls: string[] = [];
    const store = createRedisRefreshTokenStore({
      client: {
        get: async (key) => {
          calls.push(`get:${key}`);
          return values.get(key) ?? null;
        },
        set: async (key, value) => {
          calls.push(`set:${key}`);
          values.set(key, value);
        },
        del: async (key) => {
          calls.push(`del:${key}`);
          values.delete(key);
        },
      },
      prefix: "app:",
      key: "salesforce:user",
    });
    await store.setRefreshToken("refresh");
    assert.equal(await store.getRefreshToken(), "refresh");
    await store.deleteRefreshToken();
    assert.deepEqual(calls, [
      "set:app:salesforce:user",
      "get:app:salesforce:user",
      "del:app:salesforce:user",
    ]);
  });
});
