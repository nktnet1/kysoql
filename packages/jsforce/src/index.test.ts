import { describe, expect, it } from "vitest";

import {
  createJsforceExecutor,
  type JsforceExecutor,
} from "./index.js";

describe("createJsforceExecutor", () => {
  it("preserves the provided executor", async () => {
    const calls: string[] = [];
    const provided: JsforceExecutor = {
      async query<Result>(soql: string): Promise<readonly Result[]> {
        calls.push(soql);
        return [];
      },
    };

    const executor = createJsforceExecutor(provided);

    await expect(
      executor.query<{ readonly Id: string }>("SELECT Id FROM Account"),
    ).resolves.toEqual([]);
    expect(executor).toBe(provided);
    expect(calls).toEqual(["SELECT Id FROM Account"]);
  });
});
