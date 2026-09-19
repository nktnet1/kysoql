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

const renderDataCategoryGroup = (
  name: string,
  categories: readonly string[],
): string => {
  const categoryType =
    categories.length > 0 ? stringUnion(categories) : "never";
  return `      readonly ${quote(name)}: ${categoryType};`;
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

const renderImports = (
  objects: readonly SalesforceObjectDescription[],
): readonly string[] => {
  const imports = [
    objects.some((object) =>
      object.childRelationships?.some((relationship) =>
        Boolean(relationship.relationshipName),
      ),
    )
      ? "SalesforceChildRelationship"
      : undefined,
    objects.some((object) => object.fields.length > 0)
      ? "SalesforceField"
      : undefined,
    objects.some((object) =>
      object.fields.some((field) => field.type === "location"),
    )
      ? "SalesforceGeolocation"
      : undefined,
    objects.length > 0 ? "SalesforceObject" : undefined,
    objects.some((object) =>
      object.fields.some(
        (field) =>
          Boolean(field.relationshipName) && Boolean(field.referenceTo?.length),
      ),
    )
      ? "SalesforceParentRelationship"
      : undefined,
  ].filter((name): name is string => name !== undefined);

  return imports.length > 0
    ? [
        "import type {",
        ...imports.map((name) => `  ${name},`),
        '} from "@kysoql/core";',
        "",
      ]
    : [];
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
    entries.length > 0
      ? `    {\n${entries.join("\n")}\n    }`
      : "    Record<never, never>";

  const supportedScopeType = object.supportedScopes?.length
    ? stringUnion(object.supportedScopes.map((scope) => scope.name))
    : "never";
  const dataCategoryGroups = [...(object.dataCategoryGroups ?? [])]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((group) => renderDataCategoryGroup(group.name, group.categories));

  return [
    `  readonly ${quote(object.name)}: SalesforceObject<`,
    `${renderBlock(fields.map(renderField))},`,
    `${renderBlock(parents)},`,
    `${renderBlock(children)},`,
    `    ${supportedScopeType},`,
    `${renderBlock(dataCategoryGroups)},`,
    `    ${object.mruEnabled === undefined ? "boolean" : booleanLiteral(object.mruEnabled)}`,
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
    ...renderImports(sortedObjects),
    `export interface ${schemaName} {`,
    sortedObjects.map(renderObject).join("\n"),
    "}",
  ].join("\n")}\n`;
};
