import { expect, it } from "vitest";

import { forwardedArgs, run } from "../../../scripts/lib/command.ts";

it("normalizes a package-manager argument separator", () => {
  expect(forwardedArgs(["--", "--publish"])).toEqual(["--publish"]);
  expect(forwardedArgs(["--publish"])).toEqual(["--publish"]);
});

it("includes captured stdout when a command fails", () => {
  expect(() =>
    run(
      process.execPath,
      ["-e", 'process.stdout.write("registry 404 not found"); process.exit(1)'],
      { capture: true },
    ),
  ).toThrow(/registry 404 not found/u);
});
