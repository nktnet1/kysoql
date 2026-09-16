import { describe, expect, it } from "vitest";

import { generateSchema } from "./index.js";

describe("generateSchema", () => {
  it("reports that schema generation is not implemented yet", async () => {
    await expect(
      generateSchema({ output: "salesforce.generated.ts" }),
    ).rejects.toThrow("Schema generation is not implemented yet.");
  });
});
