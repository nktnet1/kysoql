import { expect, it } from "vitest";

import { nextBetaVersion } from "./beta-version.ts";

it("selects beta.1 when the release line has no beta yet", () => {
  expect(
    nextBetaVersion(
      "0.2.0",
      "0.1.0",
      ["0.0.0-bootstrap.0", "0.1.0"],
      ["v0.1.0"],
    ),
  ).toBe("0.2.0-beta.1");
});

it("selects above manifest, registry, local, and remote beta numbers", () => {
  expect(
    nextBetaVersion(
      "0.2.0",
      "0.2.0-beta.2",
      ["0.2.0-beta.4", "0.2.0-rc.99"],
      ["v0.2.0-beta.3", "v0.2.0-beta.7"],
    ),
  ).toBe("0.2.0-beta.8");
});

it("rejects a beta line whose stable version is already published", () => {
  expect(() =>
    nextBetaVersion("0.2.0", "0.2.0-beta.3", ["0.2.0"], []),
  ).toThrow("already released");
});

it("requires a stable base version", () => {
  expect(() =>
    nextBetaVersion("0.2.0-beta.1", "0.1.0", [], []),
  ).toThrow("stable x.y.z");
});
