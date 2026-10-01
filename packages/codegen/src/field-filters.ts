import type { ObjectFieldFilter, ObjectFieldFilters } from "#src/config";
import type { SalesforceObjectDescription } from "#src/types";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));

const invalid = (path: string, message: string): never => {
  throw new TypeError(`Invalid Kysoql ${path}: ${message}`);
};

/** Validate both file configs and direct API calls, without contacting Salesforce. */
export const parseFieldFilters = (
  input: unknown,
  path = "fields",
): ObjectFieldFilters => {
  if (!isPlainObject(input) || Object.getOwnPropertySymbols(input).length > 0) {
    return invalid(path, "expected a plain object keyed by object API name.");
  }

  const entries: [string, ObjectFieldFilter][] = [];
  for (const [objectName, rule] of Object.entries(input)) {
    const rulePath = `${path}.${objectName}`;
    if (!objectName.trim()) {
      return invalid(path, "object API names must not be blank.");
    }
    if (!isPlainObject(rule) || Object.getOwnPropertySymbols(rule).length > 0) {
      return invalid(rulePath, "expected an include or exclude rule.");
    }
    const keys = Object.keys(rule);
    const [mode] = keys;
    if (keys.length !== 1 || (mode !== "include" && mode !== "exclude")) {
      return invalid(rulePath, "use exactly one of include or exclude.");
    }

    const values: unknown = rule[mode];
    const listPath = `${rulePath}.${mode}`;
    if (!Array.isArray(values)) {
      return invalid(listPath, "expected an array of exact field API names.");
    }
    const names: string[] = [];
    for (const [index, name] of values.entries()) {
      if (typeof name !== "string" || !name.trim()) {
        return invalid(
          `${listPath}[${index}]`,
          "expected a non-blank field API name.",
        );
      }
      names.push(name);
    }
    if (mode === "include" && names.length === 0) {
      return invalid(listPath, "include must contain at least one field.");
    }
    const uniqueNames = [...new Set(names)];
    entries.push([
      objectName,
      mode === "include" ? { include: uniqueNames } : { exclude: uniqueNames },
    ]);
  }
  // Safe even for an own __proto__ key; never mutate a user-supplied object.
  return Object.fromEntries(entries);
};

/** Apply validated rules only to selected objects, retaining original field metadata. */
export const applyFieldFilters = (
  objects: readonly SalesforceObjectDescription[],
  filters: ObjectFieldFilters,
): readonly SalesforceObjectDescription[] => {
  const rules = new Map(Object.entries(filters));
  if (!objects.some((object) => rules.has(object.name))) {
    return objects;
  }

  const filtered = objects.map((object): SalesforceObjectDescription => {
    const rule = rules.get(object.name);
    if (rule === undefined) {
      return object;
    }
    const include = rule.include !== undefined;
    const names = rule.include ?? rule.exclude;
    const rulePath = `fields.${object.name}.${include ? "include" : "exclude"}`;
    const knownFields = new Set(object.fields.map((field) => field.name));
    const unavailable = names.filter((name) => !knownFields.has(name));
    if (unavailable.length > 0) {
      const listed = unavailable.map((name) => JSON.stringify(name)).join(", ");
      return invalid(
        rulePath,
        `unknown or unavailable field(s): ${listed}. ` +
          "Use exact API names visible to the authenticated Describe user.",
      );
    }
    const selected = new Set(names);
    const fields = object.fields.filter(
      (field) => selected.has(field.name) === include,
    );
    if (fields.length === 0) {
      return invalid(rulePath, "the rule removes every field from the object.");
    }
    // Mark every explicit rule, even a currently no-op rule. A later Describe may
    // gain fields; FIELDS() expands on Salesforce, not against these declarations.
    return { ...object, fields, fieldsComplete: false };
  });

  const fieldsByObject = new Map(
    filtered.map((object) => [
      object.name,
      new Set(object.fields.map((field) => field.name)),
    ]),
  );
  return filtered.map((object) => {
    if (object.childRelationships === undefined) {
      return object;
    }
    const unavailableNames = new Set<string>();
    for (const relationship of object.childRelationships) {
      if (
        relationship.relationshipName &&
        !fieldsByObject.get(relationship.childSObject)?.has(relationship.field)
      ) {
        unavailableNames.add(relationship.relationshipName);
      }
    }
    return {
      ...object,
      // Do not turn a same-name, multi-branch relationship into a narrower one.
      childRelationships: object.childRelationships.filter(
        (relationship) =>
          fieldsByObject
            .get(relationship.childSObject)
            ?.has(relationship.field) &&
          (!relationship.relationshipName ||
            !unavailableNames.has(relationship.relationshipName)),
      ),
    };
  });
};
