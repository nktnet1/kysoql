import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Kysoql } from "../../packages/core/dist/index.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..");
const salesforceDir = path.join(repoRoot, "test", "salesforce");
const targetOrg = process.env.KYSOQL_TARGET_ORG ?? "kysoql-test";

const runSfQuery = (soql) => {
  const command = spawnSync(
    "pnpm",
    [
      "sf",
      "data",
      "query",
      "--target-org",
      targetOrg,
      "--query",
      soql,
      "--json",
    ],
    {
      cwd: salesforceDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (command.error) {
    throw new Error(`unable to execute Salesforce CLI: ${command.error.message}`);
  }

  let response;
  try {
    response = JSON.parse(command.stdout);
  } catch {
    const stderr = command.stderr.trim();
    throw new Error(
      `Salesforce CLI returned non-JSON output for ${soql}${stderr ? `\n${stderr}` : ""}`,
    );
  }

  if (command.status !== 0 || response.status !== 0) {
    const detail =
      response.message ?? response.name ?? command.stderr.trim() ?? "unknown error";
    throw new Error(`Salesforce rejected generated SOQL:\n${soql}\n${detail}`);
  }

  return response.result;
};

const compile = (builder) => builder.compile().soql;
const db = new Kysoql();

describe(`generated-query Salesforce E2E (${targetOrg})`, () => {
  it("executes record filtering and ordering", () => {
    const soql = compile(
      db
        .selectFrom("Kysoql_Record__c")
        .select([
          "Id",
          "External_Id__c",
          "Amount__c",
          "Active__c",
          "Category__c",
          "Occurred_On__c",
        ])
        .where("External_Id__c", "like", "KYSOQL-%")
        .orderBy("External_Id__c")
        .limit(3),
    );

    expect(soql).toBe(
      "SELECT Id, External_Id__c, Amount__c, Active__c, Category__c, Occurred_On__c FROM Kysoql_Record__c WHERE External_Id__c LIKE 'KYSOQL-%' ORDER BY External_Id__c LIMIT 3",
    );

    const result = runSfQuery(soql);

    expect(
      result.records.map((record) => ({
        externalId: record.External_Id__c,
        amount: Number(record.Amount__c),
        active: record.Active__c,
        category: record.Category__c,
        occurredOn: record.Occurred_On__c,
      })),
    ).toEqual([
      {
        externalId: "KYSOQL-001",
        amount: 100.5,
        active: true,
        category: "Alpha",
        occurredOn: "2026-01-15",
      },
      {
        externalId: "KYSOQL-002",
        amount: 250,
        active: true,
        category: "Beta",
        occurredOn: "2026-02-20",
      },
      {
        externalId: "KYSOQL-003",
        amount: 75.25,
        active: false,
        category: "Gamma",
        occurredOn: "2026-03-05",
      },
    ]);
  });

  it("executes root OFFSET and explicit null placement", () => {
    const soql = compile(
      db
        .selectFrom("Kysoql_Record__c")
        .select(["Id", "External_Id__c", "Amount__c"])
        .where("External_Id__c", "like", "KYSOQL-%")
        .orderBy("Amount__c", "asc", "first")
        .orderBy("External_Id__c")
        .limit(2)
        .offset(1),
    );

    expect(soql).toBe(
      "SELECT Id, External_Id__c, Amount__c FROM Kysoql_Record__c WHERE External_Id__c LIKE 'KYSOQL-%' ORDER BY Amount__c ASC NULLS FIRST, External_Id__c LIMIT 2 OFFSET 1",
    );

    const result = runSfQuery(soql);

    expect(
      result.records.map((record) => [
        record.External_Id__c,
        Number(record.Amount__c),
      ]),
    ).toEqual([
      ["KYSOQL-001", 100.5],
      ["KYSOQL-002", 250],
    ]);
  });

  it("executes child-to-parent relationship selection", () => {
    const soql = compile(
      db
        .selectFrom("Kysoql_Record__c")
        .select([
          "Id",
          "External_Id__c",
          "Account__r.Id",
          "Account__r.Name",
        ])
        .where("External_Id__c", "like", "KYSOQL-%")
        .orderBy("External_Id__c"),
    );

    expect(soql).toBe(
      "SELECT Id, External_Id__c, Account__r.Id, Account__r.Name FROM Kysoql_Record__c WHERE External_Id__c LIKE 'KYSOQL-%' ORDER BY External_Id__c",
    );

    const result = runSfQuery(soql);

    expect(
      result.records.map((record) => [
        record.External_Id__c,
        record.Account__r?.Name,
      ]),
    ).toEqual([
      ["KYSOQL-001", "Kysoql Test Acme"],
      ["KYSOQL-002", "Kysoql Test Acme"],
      ["KYSOQL-003", "Kysoql Test Globex"],
    ]);
  });

  it("executes parent-to-child relationship subqueries", () => {
    const soql = compile(
      db
        .selectFrom("Account")
        .select(["Id", "Name"])
        .selectSubquery("Kysoql_Records__r", (records) =>
          records
            .select(["Id", "External_Id__c", "Amount__c"])
            .orderBy("External_Id__c"),
        )
        .where("Name", "like", "Kysoql Test %")
        .orderBy("Name"),
    );

    expect(soql).toBe(
      "SELECT Id, Name, (SELECT Id, External_Id__c, Amount__c FROM Kysoql_Records__r ORDER BY External_Id__c) FROM Account WHERE Name LIKE 'Kysoql Test %' ORDER BY Name",
    );

    const result = runSfQuery(soql);

    expect(
      result.records.map((record) => ({
        name: record.Name,
        children:
          record.Kysoql_Records__r?.records?.map(
            (child) => child.External_Id__c,
          ) ?? [],
      })),
    ).toEqual([
      {
        name: "Kysoql Test Acme",
        children: ["KYSOQL-001", "KYSOQL-002"],
      },
      {
        name: "Kysoql Test Globex",
        children: ["KYSOQL-003"],
      },
    ]);
  });

  it("executes direct non-aggregate GROUP BY", () => {
    const soql = compile(
      db
        .selectFrom("Kysoql_Record__c")
        .groupBy("Category__c")
        .select("Category__c")
        .orderBy("Category__c"),
    );

    expect(soql).toBe(
      "SELECT Category__c FROM Kysoql_Record__c GROUP BY Category__c ORDER BY Category__c",
    );

    const result = runSfQuery(soql);

    expect(result.records.map((record) => record.Category__c)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
  });

  it("executes grouped aggregates and checks aggregate values", () => {
    const soql = compile(
      db
        .selectFrom("Kysoql_Record__c")
        .select(({ fn }) => [
          fn.count("Id").as("recordCount"),
          fn.sum("Amount__c").as("totalAmount"),
        ])
        .groupBy("Category__c")
        .select("Category__c")
        .orderBy("Category__c"),
    );

    expect(soql).toBe(
      "SELECT COUNT(Id) recordCount, SUM(Amount__c) totalAmount, Category__c FROM Kysoql_Record__c GROUP BY Category__c ORDER BY Category__c",
    );

    const result = runSfQuery(soql);

    expect(
      result.records.map((record) => ({
        category: record.Category__c,
        count: Number(record.recordCount),
        total: Number(record.totalAmount),
      })),
    ).toEqual([
      { category: "Alpha", count: 1, total: 100.5 },
      { category: "Beta", count: 1, total: 250 },
      { category: "Gamma", count: 1, total: 75.25 },
    ]);
  });
});
