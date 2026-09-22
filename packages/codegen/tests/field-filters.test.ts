import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { describe, it } from "vitest";

import { applyFieldFilters, parseFieldFilters } from "#/field-filters";
import { renderSchema } from "#/render";
import type { SalesforceObjectDescription } from "#/types";

import { field, fixtureFilters, fixtureObjects } from "./fixtures/field-filtering.js";

const getObject = (
  objects: readonly SalesforceObjectDescription[],
  name: string,
): SalesforceObjectDescription => {
  const object = objects.find((candidate) => candidate.name === name);
  assert.ok(object, `Missing test object: ${name}`);
  return object;
};
const fieldNames = (object: SalesforceObjectDescription): string[] =>
  object.fields.map((item) => item.name);

// Pure metadata tests need no live Salesforce org.
describe("field rule validation", () => {
  it("accepts exact include/exclude lists, deduplicates, and copies input", () => {
    const input = Object.freeze({
      Account: Object.freeze({ include: Object.freeze(["Id", "Name", "Id"]) }),
      Contact: Object.freeze({ exclude: Object.freeze(["Email"]) }),
      User: Object.freeze({ exclude: Object.freeze([]) }),
    });
    const parsed = parseFieldFilters(input);
    assert.deepEqual(parsed, {
      Account: { include: ["Id", "Name"] },
      Contact: { exclude: ["Email"] },
      User: { exclude: [] },
    });
    assert.notEqual(parsed, input);
    assert.notEqual(parsed.Account, input.Account);
    assert.deepEqual(input.Account.include, ["Id", "Name", "Id"]);
  });

  it("accepts an empty map and null-prototype maps", () => {
    assert.deepEqual(parseFieldFilters({}), {});
    const input = Object.create(null);
    input.Account = { include: ["Id"] };
    assert.deepEqual(parseFieldFilters(input), { Account: { include: ["Id"] } });
  });

  it("does not treat special property names as prototypes", () => {
    const input = JSON.parse('{"__proto__":{"include":["Id"]}}');
    const parsed = parseFieldFilters(input);
    assert.equal(Object.getPrototypeOf(parsed), Object.prototype);
    assert.ok(Object.hasOwn(parsed, "__proto__"));
    assert.deepEqual(Object.entries(parsed), [["__proto__", { include: ["Id"] }]]);
  });

  const invalidInputs: readonly [string, unknown, RegExp][] = [
    ["null map", null, /fields/],
    ["array map", [], /fields/],
    ["string map", "Account", /fields/],
    ["boolean map", true, /fields/],
    ["numeric map", 1, /fields/],
    ["date map", new Date(0), /fields/],
    ["map instance", new Map(), /fields/],
    ["factory", () => ({}), /fields/],
    ["promise", Promise.resolve({}), /fields/],
    ["blank object name", { " ": { include: ["Id"] } }, /object API names/],
    ["null rule", { Account: null }, /fields\.Account/],
    ["array rule", { Account: ["Id"] }, /fields\.Account/],
    ["empty rule", { Account: {} }, /exactly one/],
    ["both modes", { Account: { include: ["Id"], exclude: [] } }, /exactly one/],
    ["unknown mode", { Account: { includes: ["Id"] } }, /fields\.Account/],
    ["unknown option", { Account: { include: ["Id"], extra: true } }, /exactly one/],
    ["undefined list", { Account: { include: undefined } }, /fields\.Account\.include/],
    ["null list", { Account: { exclude: null } }, /fields\.Account\.exclude/],
    ["string list", { Account: { include: "Id" } }, /fields\.Account\.include/],
    ["empty include", { Account: { include: [] } }, /at least one field/],
    ["blank field", { Account: { include: [" "] } }, /include\[0\]/],
    ["numeric field", { Account: { exclude: ["Id", 1] } }, /exclude\[1\]/],
    ["pattern field", { Account: { include: [/__c$/] } }, /include\[0\]/],
    ["sparse list", { Account: { include: Array(1) } }, /include\[0\]/],
    ["symbol key", { [Symbol("Account")]: { include: ["Id"] } }, /fields/],
    ["symbol rule key", { Account: { include: ["Id"], [Symbol("extra")]: true } }, /fields\.Account/],
  ];
  for (const [name, input, message] of invalidInputs) {
    it(`rejects ${name} with an actionable path`, () => {
      assert.throws(() => parseFieldFilters(input), message);
    });
  }

  it("includes the config filename when supplied by the loader", () => {
    assert.throws(
      () => parseFieldFilters({ Account: { include: [] } }, "config in app/kysoql.config.ts: fields"),
      /app\/kysoql\.config\.ts: fields\.Account\.include/,
    );
  });
});

describe("field filtering and relationships", () => {
  it("leaves the default schema byte-for-byte unchanged", () => {
    const filtered = applyFieldFilters(fixtureObjects, {});
    assert.equal(filtered, fixtureObjects);
    assert.equal(renderSchema(filtered), renderSchema(fixtureObjects));
  });

  it("never implicitly generates objects named only by field rules", () => {
    const selected = [getObject(fixtureObjects, "User")];
    assert.equal(applyFieldFilters(selected, fixtureFilters), selected);
  });

  it("includes and excludes exact fields while keeping unspecified objects full", () => {
    const filtered = applyFieldFilters(fixtureObjects, fixtureFilters);
    assert.deepEqual(fieldNames(getObject(filtered, "Account")), ["Id", "Name", "OwnerId"]);
    assert.deepEqual(fieldNames(getObject(filtered, "Contact")), ["Id", "LastName", "AccountId"]);
    assert.deepEqual(fieldNames(getObject(filtered, "Task")), ["Id", "WhoId"]);
    assert.equal(getObject(filtered, "Account").fieldsComplete, false);
    assert.equal(getObject(filtered, "Contact").fieldsComplete, false);
    assert.equal(getObject(filtered, "User"), getObject(fixtureObjects, "User"));
    assert.equal(getObject(filtered, "User").fieldsComplete, undefined);
  });

  it("never restores Id or other excluded fields implicitly", () => {
    const filtered = applyFieldFilters(fixtureObjects, { Account: { include: ["Name"] } });
    assert.deepEqual(fieldNames(getObject(filtered, "Account")), ["Name"]);
  });

  for (const rule of [{ include: ["Id", "Name"] }, { exclude: [] }] as const) {
    it(`marks explicit ${"include" in rule ? "include" : "exclude"} rules partial even when nothing is removed`, () => {
      const filtered = applyFieldFilters(fixtureObjects, { User: rule });
      assert.equal(getObject(filtered, "User").fieldsComplete, false);
      assert.deepEqual(fieldNames(getObject(filtered, "User")), ["Id", "Name"]);
    });
  }

  for (const mode of ["include", "exclude"] as const) {
    for (const name of ["DoesNotExist", "name", "Owner.Name", "*", "Name "]) {
      it(`rejects exact-name mismatch ${JSON.stringify(name)} in ${mode}`, () => {
        const filters = parseFieldFilters({ Account: { [mode]: [name] } });
        assert.throws(
          () => applyFieldFilters(fixtureObjects, filters),
          new RegExp(`fields\\.Account\\.${mode}: unknown or unavailable field`),
        );
      });
    }
  }

  it("rejects an exclusion that empties an object", () => {
    assert.throws(
      () => applyFieldFilters(fixtureObjects, { User: { exclude: ["Id", "Name"] } }),
      /fields\.User\.exclude: the rule removes every field/,
    );
  });

  it("rejects a rule for a selected object with no visible fields", () => {
    assert.throws(
      () => applyFieldFilters([{ name: "Empty__c", fields: [] }], { Empty__c: { exclude: [] } }),
      /fields\.Empty__c\.exclude: the rule removes every field/,
    );
  });

  it("keeps retained fields and unrelated object capabilities intact", () => {
    const custom = {
      ...getObject(fixtureObjects, "Account"),
      dataCategoryGroups: [{ name: "Region__c", categories: ["All", "Sydney"] }],
    };
    const before = structuredClone(custom);
    const [result] = applyFieldFilters([custom, getObject(fixtureObjects, "User")], fixtureFilters);
    assert.ok(result);
    assert.equal(result.fields[2], custom.fields[4]);
    assert.equal(result.supportedScopes, custom.supportedScopes);
    assert.equal(result.mruEnabled, true);
    assert.equal(result.dataCategoryGroups, custom.dataCategoryGroups);
    assert.deepEqual(custom, before);
  });

  it("removes parent paths and inverse child paths when a lookup is excluded", () => {
    const filtered = applyFieldFilters(fixtureObjects, { Contact: { exclude: ["AccountId"] } });
    assert.deepEqual(getObject(filtered, "Account").childRelationships, []);
    const source = renderSchema(filtered);
    assert.ok(!source.includes('readonly "Account": SalesforceParentRelationship<'));
    assert.ok(!source.includes('readonly "Contacts": SalesforceChildRelationship<'));
  });

  it("retains child paths only when the child object and its lookup are retained", () => {
    const filtered = applyFieldFilters(fixtureObjects, fixtureFilters);
    assert.deepEqual(getObject(filtered, "Account").childRelationships, [
      { childSObject: "Contact", field: "AccountId", relationshipName: "Contacts" },
    ]);
    assert.equal(getObject(filtered, "Contact").childRelationships?.[0]?.relationshipName, "Tasks");
  });

  it("keeps complete polymorphic targets when a target object is not generated", () => {
    const filtered = applyFieldFilters(fixtureObjects, fixtureFilters);
    const who = getObject(filtered, "Task").fields.find((item) => item.name === "WhoId");
    assert.deepEqual(who?.referenceTo, ["Contact", "Lead"]);
    assert.equal(who?.polymorphicForeignKey, true);
    const source = renderSchema(filtered);
    assert.ok(source.includes('readonly referenceTo: "Contact" | "Lead";'));
    assert.ok(source.includes('readonly "Who": SalesforceParentRelationship<\n        "Contact" | "Lead",'));
    assert.ok(source.includes("readonly polymorphic: true;"));
    assert.ok(!source.includes('readonly "Lead": SalesforceObject<'));
  });

  it("never narrows a colliding child relationship by discarding one branch", () => {
    const objects = [
      {
        name: "Account",
        fields: [field("Id")],
        childRelationships: [
          { childSObject: "Contact", field: "AccountId", relationshipName: "Children" },
          { childSObject: "Other__c", field: "Account__c", relationshipName: "Children" },
        ],
      },
      getObject(fixtureObjects, "Contact"),
      { name: "Other__c", fields: [field("Id"), field("Account__c")] },
    ];
    const filtered = applyFieldFilters(objects, { Other__c: { include: ["Id"] } });
    assert.deepEqual(getObject(filtered, "Account").childRelationships, []);
  });

  it("remains deterministic when object order and rule order change", () => {
    const reordered = parseFieldFilters({
      Task: { include: ["WhoId", "Id", "Id"] },
      Contact: { exclude: ["Secret__c", "Email"] },
      Account: { include: ["OwnerId", "Name", "Id"] },
    });
    assert.equal(
      renderSchema(applyFieldFilters([...fixtureObjects].reverse(), reordered)),
      renderSchema(applyFieldFilters(fixtureObjects, fixtureFilters)),
    );
  });

  it("renders the exact generated schema exercised by core's type regression tests", async () => {
    const expected = await readFile(
      new URL("../../core/tests/fixtures/field-filtered.generated.ts", import.meta.url),
      "utf8",
    );
    assert.equal(renderSchema(applyFieldFilters(fixtureObjects, fixtureFilters), "FilteredSchema"), expected);
  });
});
