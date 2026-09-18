import { describe, expect, it } from "vitest";

import { parseSchemaName } from "#/validation";

describe("codegen validation", () => {
  it.each(["Schema", "_Schema", "$Schema", "Schema9"])(
    "accepts a valid TypeScript schema identifier: %s",
    (schemaName) => {
      expect(parseSchemaName(schemaName)).toBe(schemaName);
    },
  );

  it.each(["not-valid", "9Invalid", "with space", "Salesforce.Schema", ""])(
    "rejects an invalid TypeScript schema identifier: %j",
    (schemaName) => {
      expect(() => parseSchemaName(schemaName)).toThrow(
        `Invalid schema name: ${schemaName}`,
      );
    },
  );
});
