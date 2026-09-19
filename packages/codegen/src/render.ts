import type {
  SalesforceChildRelationshipDescription,
  SalesforceFieldDescription,
  SalesforceObjectDescription,
} from "#/types";

const quote = (value: string): string => JSON.stringify(value);

const booleanLiteral = (value: boolean): "true" | "false" =>
  value ? "true" : "false";

const stringUnion = (values: readonly string[]): string => {
  const uniqueValues = [...new Set(values)].sort((left, right) =>
    left.localeCompare(right),
  );

  if (uniqueValues.length === 0) {
    return "string";
  }

  return uniqueValues.map(quote).join(" | ");
};

const fieldValueType = (field: SalesforceFieldDescription): string => {
  switch (field.type) {
    case "boolean":
      return "boolean";
    case "currency":
    case "double":
    case "int":
    case "percent":
      return "number";
    case "location":
      return "SalesforceGeolocation";
    case "base64":
    case "combobox":
    case "date":
    case "datetime":
    case "email":
    case "encryptedstring":
    case "id":
    case "multipicklist":
    case "phone":
    case "picklist":
    case "reference":
    case "string":
    case "textarea":
    case "time":
    case "url":
      return "string";
    default:
      return "unknown";
  }
};

const activePicklistType = (field: SalesforceFieldDescription): string => {
  if (field.type !== "picklist" && field.type !== "multipicklist") {
    return "never";
  }

  const values = (field.picklistValues ?? [])
    .filter((value) => value.active !== false)
    .map((value) => value.value);
  return values.length > 0 ? stringUnion(values) : "never";
};

const fieldReferenceType = (field: SalesforceFieldDescription): string =>
  stringUnion(field.referenceTo ?? []);

const fieldRelationshipType = (field: SalesforceFieldDescription): string =>
  field.relationshipName ? quote(field.relationshipName) : "never";

const fieldPolymorphic = (field: SalesforceFieldDescription): boolean =>
  field.type === "reference" &&
  Boolean(field.relationshipName) &&
  field.namePointing === true &&
  field.polymorphicForeignKey === true &&
  new Set(field.referenceTo ?? []).size > 1;

const renderField = (field: SalesforceFieldDescription): string => {
  const referenceTo = field.referenceTo?.length
    ? fieldReferenceType(field)
    : "never";

  return [
    `      readonly ${quote(field.name)}: SalesforceField<`,
    `        ${fieldValueType(field)},`,
    `        ${quote(field.type)},`,
    `        ${booleanLiteral(field.nillable)},`,
    `        ${booleanLiteral(field.filterable)},`,
    `        ${booleanLiteral(field.sortable)},`,
    `        ${booleanLiteral(field.groupable)},`,
    `        ${referenceTo},`,
    `        ${fieldRelationshipType(field)},`,
    `        ${activePicklistType(field)},`,
    `        ${booleanLiteral(field.aggregatable)},`,
    `        ${booleanLiteral(field.custom)},`,
    `        ${booleanLiteral(fieldPolymorphic(field))}`,
    "      >;",
  ].join("\n");
};

const renderParentRelationship = (
  field: SalesforceFieldDescription,
): string | undefined => {
  if (!field.relationshipName || !field.referenceTo?.length) {
    return undefined;
  }

  return [
    `      readonly ${quote(field.relationshipName)}: SalesforceParentRelationship<`,
    `        ${stringUnion(field.referenceTo)},`,
    `        ${quote(field.name)},`,
    `        ${booleanLiteral(field.nillable)}`,
    "      >;",
  ].join("\n");
};

const renderChildRelationship = (
  relationship: SalesforceChildRelationshipDescription,
): string | undefined => {
  if (!relationship.relationshipName) {
    return undefined;
  }

  return [
    `      readonly ${quote(relationship.relationshipName)}: SalesforceChildRelationship<`,
    `        ${quote(relationship.childSObject)},`,
    `        ${quote(relationship.field)}`,
    "      >;",
  ].join("\n");
};

const renderObject = (object: SalesforceObjectDescription): string => {
  const fields = [...object.fields].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const parents = fields
    .map(renderParentRelationship)
    .filter(
      (relationship): relationship is string => relationship !== undefined,
    );
  const children = [...(object.childRelationships ?? [])]
    .sort((left, right) =>
      (left.relationshipName ?? "").localeCompare(right.relationshipName ?? ""),
    )
    .map(renderChildRelationship)
    .filter(
      (relationship): relationship is string => relationship !== undefined,
    );

  const renderBlock = (entries: readonly string[]): string =>
    entries.length > 0 ? `    {\n${entries.join("\n")}\n    }` : "    {}";

  return [
    `  readonly ${quote(object.name)}: SalesforceObject<`,
    `${renderBlock(fields.map(renderField))},`,
    `${renderBlock(parents)},`,
    renderBlock(children),
    "  >;",
  ].join("\n");
};

export const renderSchema = (
  objects: readonly SalesforceObjectDescription[],
  schemaName = "SalesforceSchema",
): string => {
  const sortedObjects = [...objects].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  return `${[
    "// This file is generated by @kysoql/codegen. Do not edit manually.",
    "",
    "import type {",
    "  SalesforceChildRelationship,",
    "  SalesforceField,",
    "  SalesforceGeolocation,",
    "  SalesforceObject,",
    "  SalesforceParentRelationship,",
    '} from "@kysoql/core";',
    "",
    `export interface ${schemaName} {`,
    sortedObjects.map(renderObject).join("\n"),
    "}",
  ].join("\n")}\n`;
};
