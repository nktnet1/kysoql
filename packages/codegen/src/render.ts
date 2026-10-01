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

  const relationshipName = fieldRelationshipType(field);
  const activePicklistValue = activePicklistType(field);
  const polymorphic = fieldPolymorphic(field);
  const metadata = [
    `          readonly salesforceType: ${quote(field.type)};`,
    `          readonly nullable: ${booleanLiteral(field.nillable)};`,
    `          readonly filterable: ${booleanLiteral(field.filterable)};`,
    `          readonly sortable: ${booleanLiteral(field.sortable)};`,
    `          readonly groupable: ${booleanLiteral(field.groupable)};`,
    ...(referenceTo === "never"
      ? []
      : [`          readonly referenceTo: ${referenceTo};`]),
    ...(relationshipName === "never"
      ? []
      : [`          readonly relationshipName: ${relationshipName};`]),
    ...(activePicklistValue === "never"
      ? []
      : [`          readonly activePicklistValue: ${activePicklistValue};`]),
    ...(field.aggregatable ? ["          readonly aggregatable: true;"] : []),
    ...(field.custom ? ["          readonly custom: true;"] : []),
    ...(polymorphic ? ["          readonly polymorphic: true;"] : []),
  ];

  return [
    `      readonly ${quote(field.name)}: SalesforceField<`,
    `        ${fieldValueType(field)},`,
    "        {",
    ...metadata,
    "        }",
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

const compareChildRelationships = (
  left: SalesforceChildRelationshipDescription,
  right: SalesforceChildRelationshipDescription,
): number =>
  left.childSObject.localeCompare(right.childSObject) ||
  left.field.localeCompare(right.field);

const uniqueChildRelationships = (
  relationships: readonly SalesforceChildRelationshipDescription[],
): readonly SalesforceChildRelationshipDescription[] => {
  const seenFieldsByObject = new Map<string, Set<string>>();
  const uniqueRelationships: SalesforceChildRelationshipDescription[] = [];

  for (const relationship of relationships) {
    let fields = seenFieldsByObject.get(relationship.childSObject);
    if (!fields) {
      fields = new Set<string>();
      seenFieldsByObject.set(relationship.childSObject, fields);
    }

    if (fields.has(relationship.field)) {
      continue;
    }

    fields.add(relationship.field);
    uniqueRelationships.push(relationship);
  }

  return uniqueRelationships.sort(compareChildRelationships);
};

const renderChildRelationship = (
  relationshipName: string,
  relationships: readonly SalesforceChildRelationshipDescription[],
): string => {
  const uniqueRelationships = uniqueChildRelationships(relationships);
  const [relationship] = uniqueRelationships;

  if (!relationship) {
    throw new Error("Expected at least one child relationship");
  }

  if (uniqueRelationships.length === 1) {
    return [
      `      readonly ${quote(relationshipName)}: SalesforceChildRelationship<`,
      `        ${quote(relationship.childSObject)},`,
      `        ${quote(relationship.field)}`,
      "      >;",
    ].join("\n");
  }

  return [
    `      readonly ${quote(relationshipName)}:`,
    ...uniqueRelationships.flatMap((relationship, index) => [
      "        | SalesforceChildRelationship<",
      `            ${quote(relationship.childSObject)},`,
      `            ${quote(relationship.field)}`,
      `          >${index === uniqueRelationships.length - 1 ? ";" : ""}`,
    ]),
  ].join("\n");
};

const renderChildRelationships = (
  relationships: readonly SalesforceChildRelationshipDescription[],
): readonly string[] => {
  const groupedRelationships = new Map<
    string,
    SalesforceChildRelationshipDescription[]
  >();

  for (const relationship of relationships) {
    const relationshipName = relationship.relationshipName;
    if (!relationshipName) {
      continue;
    }

    const existing = groupedRelationships.get(relationshipName);
    if (existing) {
      existing.push(relationship);
    } else {
      groupedRelationships.set(relationshipName, [relationship]);
    }
  }

  return [...groupedRelationships.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([relationshipName, grouped]) =>
      renderChildRelationship(relationshipName, grouped),
    );
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
  const children = renderChildRelationships(object.childRelationships ?? []);

  const renderBlock = (entries: readonly string[]): string =>
    entries.length > 0
      ? `    {\n${entries.join("\n")}\n    }`
      : "    Record<string, never>";

  const supportedScopeType = object.supportedScopes?.length
    ? stringUnion(object.supportedScopes.map((scope) => scope.name))
    : "never";
  const dataCategoryGroups = [...(object.dataCategoryGroups ?? [])]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((group) => renderDataCategoryGroup(group.name, group.categories));

  const objectName = object.name.toLowerCase();
  const setOptionsCapability = objectName.endsWith("__dll")
    ? "data360-dlo"
    : objectName.endsWith("__dlm")
      ? "data360-dmo"
      : "none";

  return [
    `  readonly ${quote(object.name)}: SalesforceObject<`,
    `${renderBlock(fields.map(renderField))},`,
    `${renderBlock(parents)},`,
    `${renderBlock(children)},`,
    `    ${supportedScopeType},`,
    `${renderBlock(dataCategoryGroups)},`,
    `    ${object.mruEnabled === undefined ? "boolean" : booleanLiteral(object.mruEnabled)},`,
    `    ${JSON.stringify(setOptionsCapability)}${object.fieldsComplete === false ? "," : ""}`,
    ...(object.fieldsComplete === false ? ["    false"] : []),
    "  >;",
  ].join("\n");
};

const DATA360_STRING_FIELD_TYPES = new Set([
  "combobox",
  "email",
  "encryptedstring",
  "multipicklist",
  "phone",
  "picklist",
  "string",
  "textarea",
  "url",
]);

const renderMetadataFieldMap = (
  objects: readonly SalesforceObjectDescription[],
  selectFields: (object: SalesforceObjectDescription) => readonly string[],
): readonly string[] =>
  objects
    .filter((object) => {
      const lower = object.name.toLowerCase();
      return lower.endsWith("__dll") || lower.endsWith("__dlm");
    })
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((object) => {
      const fields = [...selectFields(object)].sort((left, right) =>
        left.localeCompare(right),
      );
      return `    ${quote(object.name)}: [${fields.map(quote).join(", ")}],`;
    });

const renderSchemaMetadata = (
  objects: readonly SalesforceObjectDescription[],
): string => {
  const bigObjectIndexes = objects
    .flatMap((object) => {
      const index = object.bigObjectIndex;
      return index === undefined ? [] : [{ name: object.name, index }];
    })
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(
      ({ name, index }) =>
        `    ${quote(name)}: [${index.map(quote).join(", ")}],`,
    );
  const data360StringFields = renderMetadataFieldMap(objects, (object) =>
    object.fields
      .filter((field) =>
        DATA360_STRING_FIELD_TYPES.has(field.type.toLowerCase()),
      )
      .map((field) => field.name),
  );
  const data360LookupFields = renderMetadataFieldMap(objects, (object) =>
    object.fields
      .filter((field) => (field.referenceTo?.length ?? 0) > 0)
      .map((field) => field.name),
  );

  return [
    "export const salesforceSchemaMetadata = {",
    "  bigObjectIndexes: {",
    ...bigObjectIndexes,
    "  },",
    "  data360StringFields: {",
    ...data360StringFields,
    "  },",
    "  data360LookupFields: {",
    ...data360LookupFields,
    "  },",
    "} as const;",
  ].join("\n");
};

/**
 * Renders Salesforce object metadata as a TypeScript Kysoql schema module.
 */
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
    "",
    renderSchemaMetadata(sortedObjects),
  ].join("\n")}\n`;
};
