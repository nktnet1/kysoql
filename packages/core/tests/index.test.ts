import { describe, expect, it } from "vitest";

import { kysoql } from "../src/index.js";

describe("kysoql", () => {
  it("exposes the package version", () => {
    expect(kysoql()).toEqual({ version: "0.0.0" });
  });
});
