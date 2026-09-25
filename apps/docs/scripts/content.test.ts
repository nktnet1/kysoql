import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  codeBlockIssues,
  codeBlocks,
  linkTargetIds,
  stripCodeBlocks,
} from "./content.ts";

const block = (info: string, code = "const answer: number = 42;") =>
  `\`\`\`${info}\n${code}\n\`\`\`\n`;

describe("documentation code fences", () => {
  for (const label of ["ts", "typescript"]) {
    it(`checks ${label} examples with Fumadocs metadata`, () => {
      const [example] = codeBlocks(block(`${label} title="src/db.ts" {1,3-5}`));
      assert.equal(example.language, "ts");
      assert.equal(example.metadata, 'title="src/db.ts" {1,3-5}');
      assert.deepEqual(codeBlockIssues(example), []);
    });
  }

  it("accepts CRLF, indentation, tildes, and a closing fence at EOF", () => {
    const [example] = codeBlocks(
      '  ~~~typescript title="query.ts"\r\n  const n = 1;\r\n  ~~~~',
    );
    assert.equal(example.language, "ts");
    assert.equal(example.code, "const n = 1;");
    assert.equal(example.closed, true);
    assert.deepEqual(codeBlockIssues(example), []);
  });

  it("reports fence and first-code-line positions independently", () => {
    const [example] = codeBlocks(`\n\n${block("ts")}`);
    assert.equal(example.fenceLine, 3);
    assert.equal(example.line, 4);
    assert.equal(example.endLine, 5);
  });

  it("does not consume the next adjacent opening fence", () => {
    const examples = codeBlocks(`${block("ts")}${block("typescript")}`);
    assert.deepEqual(
      examples.map((example) => example.language),
      ["ts", "ts"],
    );
    assert.deepEqual(
      examples.map((example) => example.line),
      [2, 5],
    );
  });

  it("requires a closing fence with the same marker and enough characters", () => {
    const [example] = codeBlocks("````text\n```ts\nexample\n```\n~~~\n````");
    assert.equal(example.code, "```ts\nexample\n```\n~~~");
    assert.equal(example.closed, true);
  });

  it("does not treat a labelled fence inside code as a closing fence", () => {
    const [example] = codeBlocks("```text\n```ts\nexample\n```");
    assert.equal(example.code, "```ts\nexample");
    assert.equal(example.closed, true);
  });

  it("rejects unclosed blocks instead of silently dropping an example", () => {
    const [example] = codeBlocks("```ts\nconst n = 1;");
    assert.equal(example.closed, false);
    assert.match(codeBlockIssues(example).join("\n"), /line 1: unclosed/);
  });

  it("preserves empty blocks for validation", () => {
    const [example] = codeBlocks(block("ts", ""));
    assert.match(codeBlockIssues(example).join("\n"), /empty code example/);
  });

  for (const label of ["", "tyepscript"]) {
    it(`rejects and identifies the unsupported label ${JSON.stringify(label)}`, () => {
      const issues = codeBlockIssues(codeBlocks(block(label))[0]).join("\n");
      assert.match(issues, /missing\/unknown code language/);
      assert.ok(issues.includes(JSON.stringify(label)));
    });
  }

  it("normalises supported shell, JavaScript, YAML, and text aliases", () => {
    for (const [label, expected] of [
      ["sh", "bash"],
      ["shell", "bash"],
      ["javascript", "js"],
      ["yml", "yaml"],
      ["plaintext", "text"],
    ]) {
      const [example] = codeBlocks(block(label));
      assert.equal(example.language, expected);
      assert.deepEqual(codeBlockIssues(example), []);
    }
  });

  it("accepts Fumadocs npm package-manager blocks", () => {
    const [example] = codeBlocks(block("npm", "npm install @kysoql/core"));
    assert.equal(example.language, "npm");
    assert.deepEqual(codeBlockIssues(example), []);
  });

  it("still checks JSON syntax when metadata is present", () => {
    const [example] = codeBlocks(
      block('json title="package.json"', "{ nope }"),
    );
    assert.match(codeBlockIssues(example).join("\n"), /invalid JSON/);
  });

  it("rejects .js local imports in every supported JavaScript/TypeScript form", () => {
    for (const code of [
      'import { db } from "./db.js";',
      'import type { Schema } from "./schema.js";',
      'export { db } from "../db.js";',
      'import "./setup.js";',
      'await import("./db.js");',
    ]) {
      assert.match(
        codeBlockIssues(codeBlocks(block("typescript", code))[0]).join("\n"),
        /extensionless local import/,
      );
    }
    assert.deepEqual(
      codeBlockIssues(codeBlocks(block("ts", 'import { db } from "./db";'))[0]),
      [],
    );
  });

  it("masks nested-looking headings and links without changing line positions", () => {
    const source = [
      "## Before",
      block('ts title="db.ts"', "// [not prose](/missing)\n# Not a heading"),
      "## After",
    ].join("\n");
    const prose = stripCodeBlocks(source);
    assert.ok(prose.includes("## Before"));
    assert.ok(prose.includes("## After"));
    assert.ok(!prose.includes("/missing"));
    assert.ok(!prose.includes("Not a heading"));
    assert.equal(prose.split("\n").length, source.split("\n").length);
  });

  it("recognises TypeDoc table anchors as link targets", () => {
    const ids = linkTargetIds(
      [
        "## signal",
        "## signal",
        '| <a id="api-property-signal-1"></a> `signal` | `AbortSignal` |',
        "<a class='anchor' id='api-property-timeoutms-1'></a>",
      ].join("\n"),
    );

    assert.deepEqual(
      [...ids],
      [
        "signal",
        "signal-1",
        "api-property-signal-1",
        "api-property-timeoutms-1",
      ],
    );
  });
});
