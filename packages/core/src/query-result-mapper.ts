import type { AliasNode } from "#/operation-node/alias-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import type { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";
import type { SelectQueryNode } from "#/operation-node/select-query-node";

type QueryResultRecord = Record<string, unknown>;
type SelectionContainer = SelectQueryNode | RelationshipSubqueryNode;

function isRecord(value: unknown): value is QueryResultRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ReferenceValue {
  readonly found: boolean;
  readonly value: unknown;
}

function referenceValue(
  record: QueryResultRecord,
  reference: ReferenceNode,
): ReferenceValue {
  let value: unknown = record;

  for (const segment of reference.name.split(".")) {
    if (value === null) {
      return { found: true, value: null };
    }
    if (!isRecord(value) || !(segment in value)) {
      return { found: false, value: undefined };
    }
    value = value[segment];
  }

  return { found: true, value };
}

function relationshipRecords(
  value: unknown,
): readonly QueryResultRecord[] | undefined {
  if (!isRecord(value) || !Array.isArray(value.records)) {
    return undefined;
  }

  return value.records.every(isRecord) ? value.records : undefined;
}

function mapRelationshipResult(
  query: RelationshipSubqueryNode,
  value: unknown,
): unknown {
  const records = relationshipRecords(value);
  if (records === undefined || !isRecord(value)) {
    return value;
  }

  const mapped = mapRecords(query, records, false);
  return mapped === records ? value : { ...value, records: mapped };
}

function retainedReferences(query: SelectionContainer): {
  readonly names: ReadonlySet<string>;
  readonly preserveDirectFields: boolean;
} {
  const names = new Set<string>();
  let preserveDirectFields = false;

  for (const selection of query.selections ?? []) {
    const node = selection.selection;
    if (node.kind === "ReferenceNode") {
      names.add((node as ReferenceNode).name);
    } else if (node.kind === "FieldsFunctionNode") {
      preserveDirectFields = true;
    } else if (node.kind === "TypeOfNode") {
      names.add(node.reference.name);
    }
  }

  return { names, preserveDirectFields };
}

function removePath(
  record: QueryResultRecord,
  path: readonly string[],
): QueryResultRecord {
  const [head, ...tail] = path;
  if (head === undefined || !(head in record)) {
    return record;
  }

  if (tail.length === 0) {
    const output = { ...record };
    delete output[head];
    return output;
  }

  const child = record[head];
  if (!isRecord(child)) {
    return record;
  }

  const next = removePath(child, tail);
  return next === child ? record : { ...record, [head]: next };
}

function removeAliasedSource(
  record: QueryResultRecord,
  reference: ReferenceNode,
  retained: ReadonlySet<string>,
  preserveDirectFields: boolean,
): QueryResultRecord {
  const segments = reference.name.split(".");

  if (segments.length === 1) {
    return preserveDirectFields || retained.has(reference.name)
      ? record
      : removePath(record, segments);
  }

  for (let length = 1; length < segments.length; length++) {
    const prefix = segments.slice(0, length).join(".");
    const required = [...retained].some(
      (name) => name === prefix || name.startsWith(`${prefix}.`),
    );
    if (!required) {
      return removePath(record, segments.slice(0, length));
    }
  }

  return retained.has(reference.name)
    ? record
    : removePath(record, segments);
}

function mapRecord(
  query: SelectionContainer,
  record: QueryResultRecord,
  referenceAliasesAreNative: boolean,
): QueryResultRecord {
  let output = record;
  const retained = retainedReferences(query);
  const aliases: Array<{
    readonly alias: string;
    readonly reference: ReferenceNode;
    readonly value: unknown;
  }> = [];

  const set = (key: string, value: unknown): void => {
    if (output === record) {
      output = { ...record };
    }
    output[key] = value;
  };

  for (const selection of query.selections ?? []) {
    const node = selection.selection;

    if (
      node.kind === "AliasNode" &&
      !referenceAliasesAreNative &&
      (node as AliasNode).node.kind === "ReferenceNode"
    ) {
      const alias = node as AliasNode;
      const reference = alias.node as ReferenceNode;
      const source = referenceValue(record, reference);
      if (source.found) {
        aliases.push({ alias: alias.alias, reference, value: source.value });
      }
      continue;
    }

    if (node.kind === "RelationshipSubqueryNode") {
      const subquery = node as RelationshipSubqueryNode;
      const relationship = subquery.relationship.name;
      const current = record[relationship];
      const mapped = mapRelationshipResult(subquery, current);
      if (mapped !== current) {
        set(relationship, mapped);
      }
    }
  }

  for (const alias of aliases) {
    output = removeAliasedSource(
      output,
      alias.reference,
      retained.names,
      retained.preserveDirectFields,
    );
  }
  for (const alias of aliases) {
    set(alias.alias, alias.value);
  }

  return output;
}

function mapRecords(
  query: SelectionContainer,
  records: readonly QueryResultRecord[],
  referenceAliasesAreNative: boolean,
): readonly QueryResultRecord[] {
  let changed = false;
  const mapped = records.map((record) => {
    const output = mapRecord(query, record, referenceAliasesAreNative);
    changed ||= output !== record;
    return output;
  });

  return changed ? mapped : records;
}

/**
 * Applies Kysoql-only field aliases to records returned by Salesforce.
 *
 * Salesforce only accepts field aliases in grouped queries. For ordinary
 * record queries the compiler requests the source field and adapters use this
 * function to expose the requested `field as alias` property in the result.
 *
 * Official adapters call this for direct executor APIs. Query builders also
 * apply it after custom executor calls, so ordinary `.execute()` users do not
 * need to call it themselves.
 */
export function applyQueryResultAliases<O>(
  query: SelectQueryNode,
  records: readonly QueryResultRecord[],
): readonly O[] {
  return mapRecords(query, records, query.groupBy !== undefined) as readonly O[];
}
