import { describe, expect, it } from "vitest";

import { collectPublicExports } from "#scripts/verify/public-export-shape";

describe("collectPublicExports", () => {
  it("separates named runtime and type-only exports", () => {
    const exports = collectPublicExports(
      `
        export { runtimeValue, sourceName as alias, type InlineType } from "#tests/scripts/verify/module";
        export type { TypeOnly, OtherType as RenamedType } from "#tests/scripts/verify/types";
        export * as namespaceValue from "#tests/scripts/verify/namespace";
        export type * as namespaceType from "#tests/scripts/verify/namespace-types";
      `,
      "fixture",
    );

    expect(exports.all).toEqual(
      new Set([
        "runtimeValue",
        "alias",
        "InlineType",
        "TypeOnly",
        "RenamedType",
        "namespaceValue",
        "namespaceType",
      ]),
    );
    expect(exports.runtime).toEqual(
      new Set(["runtimeValue", "alias", "namespaceValue"]),
    );
  });

  it("classifies direct and default type declarations without inventing runtime exports", () => {
    const exports = collectPublicExports(
      `
        export interface Contract {}
        export type Identifier = string;
        export const enum Flag { Enabled = 1 }
        export declare const ambientValue: string;
        export class RuntimeClass {}
        export function runtimeFunction() {}
        export const runtimeValue = 1;
        export default interface DefaultContract {}
      `,
      "fixture",
    );

    expect(exports.all).toEqual(
      new Set([
        "Contract",
        "Identifier",
        "Flag",
        "ambientValue",
        "RuntimeClass",
        "runtimeFunction",
        "runtimeValue",
        "default",
      ]),
    );
    expect(exports.runtime).toEqual(
      new Set(["RuntimeClass", "runtimeFunction", "runtimeValue"]),
    );
  });

  it("keeps runtime default exports at runtime", () => {
    const exports = collectPublicExports(
      `
        export default class RuntimeDefault {}
      `,
      "fixture",
    );

    expect(exports.all).toEqual(new Set(["default"]));
    expect(exports.runtime).toEqual(new Set(["default"]));
  });

  it("ignores export-looking text inside comments and strings", () => {
    const exports = collectPublicExports(
      [
        '// export { fakeLineComment };',
        '/* export { fakeBlockComment }; */',
        'const text = "export { fakeString }";',
        "const template = `export { fakeTemplate }`;",
        "export const realValue = 1;",
      ].join("\n"),
      "fixture",
    );

    expect(exports.all).toEqual(new Set(["realValue"]));
    expect(exports.runtime).toEqual(new Set(["realValue"]));
  });

  it("rejects wildcard and export-equals surfaces that cannot be verified exactly", () => {
    expect(() =>
      collectPublicExports('export * from "#tests/scripts/verify/module";', "fixture"),
    ).toThrow(/wildcard export/u);
    expect(() => collectPublicExports("export = value;", "fixture")).toThrow(
      /export-equals/u,
    );
  });
});
