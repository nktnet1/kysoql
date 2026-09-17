import { describe, expect, it, vi } from "vitest";

import { createJsforceExecutor } from "./index.js";

describe("createJsforceExecutor", () => {
  it("preserves the provided executor", async () => {
    const query = vi.fn(async <Result>(): Promise<readonly Result[]> => []);
    const executor = createJsforceExecutor({ query });

    await expect(
      executor.query<{ readonly Id: string }>("SELECT Id FROM Account"),
    ).resolves.toEqual([]);
    expect(executor.query).toBe(query);
    expect(query).toHaveBeenCalledWith("SELECT Id FROM Account");
  });
});
