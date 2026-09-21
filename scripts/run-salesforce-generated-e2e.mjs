#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Kysoql } from "@kysoql/core";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const salesforceDir = path.join(repoRoot, "test", "salesforce");

const fail = (message) => {
  throw new Error(message);
};

const usage = () => {
  process.stdout.write(`Usage: pnpm salesforce:e2e [options]\n\nRun kysoql-generated SOQL against an authenticated Salesforce org.\n\nOptions:\n  --target-org <alias>  Salesforce org alias (default: kysoql-test)\n  -h, --help            Show this help\n\nEnvironment equivalent:\n  KYSOQL_TARGET_ORG\n`);
};

const parseArgs = (argv) => {
  let targetOrg = process.env.KYSOQL_TARGET_ORG ?? "kysoql-test";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--target-org") {
      const value = argv[index + 1];
      if (!value) {
        fail("--target-org requires a value");
      }
      targetOrg = value;
      index += 1;
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    }

    fail(`unknown option: ${arg}`);
  }

  return { targetOrg };
};

const runSfQuery = (targetOrg, soql) => {
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
    fail(`unable to execute Salesforce CLI: ${command.error.message}`);
  }

  let response;
  try {
    response = JSON.parse(command.stdout);
  } catch {
    const stderr = command.stderr.trim();
    fail(
      `Salesforce CLI returned non-JSON output for ${soql}${stderr ? `\n${stderr}` : ""}`,
    );
  }

  if (command.status !== 0 || response.status !== 0) {
    const detail =
      response.message ?? response.name ?? command.stderr.trim() ?? "unknown error";
    fail(`Salesforce rejected generated SOQL:\n${soql}\n${detail}`);
  }

  return response.result;
};

const compile = (builder) => builder.compile().soql;

const db = new Kysoql();

const cases = [
  {
    name: "record filtering and ordering",
    soql: compile(
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
    ),
    verify(result) {
      assert.equal(result.records.length, 3);
      assert.ok(
        result.records.every((record) =>
          String(record.External_Id__c ?? "").startsWith("KYSOQL-"),
        ),
      );
    },
  },
  {
    name: "root OFFSET and explicit null placement",
    soql: compile(
      db
        .selectFrom("Kysoql_Record__c")
        .select(["Id", "External_Id__c", "Amount__c"])
        .where("External_Id__c", "like", "KYSOQL-%")
        .orderBy("Amount__c", "asc", "first")
        .orderBy("External_Id__c")
        .limit(2)
        .offset(1),
    ),
    verify(result) {
      assert.equal(result.records.length, 2);
    },
  },
  {
    name: "child-to-parent relationship selection",
    soql: compile(
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
    ),
    verify(result) {
      assert.equal(result.records.length, 3);
      assert.ok(
        result.records.some((record) =>
          String(record.Account__r?.Name ?? "").startsWith("Kysoql Test "),
        ),
      );
    },
  },
  {
    name: "parent-to-child relationship subquery",
    soql: compile(
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
    ),
    verify(result) {
      assert.equal(result.records.length, 2);
      const childCount = result.records.reduce(
        (total, record) => total + (record.Kysoql_Records__r?.records?.length ?? 0),
        0,
      );
      assert.equal(childCount, 3);
    },
  },
  {
    name: "direct non-aggregate GROUP BY",
    soql: compile(
      db
        .selectFrom("Kysoql_Record__c")
        .groupBy("Category__c")
        .select("Category__c")
        .orderBy("Category__c"),
    ),
    verify(result) {
      assert.deepEqual(
        result.records.map((record) => record.Category__c),
        ["Alpha", "Beta", "Gamma"],
      );
    },
  },
  {
    name: "grouped aggregate query",
    soql: compile(
      db
        .selectFrom("Kysoql_Record__c")
        .select(({ fn }) => [
          fn.count("Id").as("recordCount"),
          fn.sum("Amount__c").as("totalAmount"),
        ])
        .groupBy("Category__c")
        .select("Category__c")
        .orderBy("Category__c"),
    ),
    verify(result) {
      assert.deepEqual(
        result.records.map((record) => record.Category__c),
        ["Alpha", "Beta", "Gamma"],
      );
      assert.ok(
        result.records.every((record) => Number(record.recordCount) === 1),
      );
    },
  },
];

const { targetOrg } = parseArgs(process.argv.slice(2));

for (const testCase of cases) {
  const result = runSfQuery(targetOrg, testCase.soql);
  testCase.verify(result);
  process.stdout.write(`ok - ${testCase.name}\n  ${testCase.soql}\n`);
}

process.stdout.write(
  `Generated-query Salesforce E2E passed: ${cases.length}/${cases.length} for ${targetOrg}.\n`,
);
