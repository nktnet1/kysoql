import { describe, expect, it, vi } from "vitest";

import { createJsforceExecutor } from "./index.js";

describe("createJsforceExecutor", () => {
  it("preserves the provided executor", async () => {
    const query = vi.fn(async () => [{ Id: "001000000000001" }]);
    const executor = createJsforceExecutor({ query });

    await expect(executor.query("SELECT Id FROM Account")).resolves.toEqual([
      { Id: "001000000000001" },
    ]);
    expect(query).toHaveBeenCalledWith("SELECT Id FROM Account");
  });
});
