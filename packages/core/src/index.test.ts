import { describe, expect, it } from "vitest";

import { kysoql } from "./index.js";

describe("kysoql", () => {
  it("exposes the package version", () => {
    expect(kysoql()).toEqual({ version: "0.0.0" });
  });
});
