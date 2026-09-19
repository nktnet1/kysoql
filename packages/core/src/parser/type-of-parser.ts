import type { SelectQueryNode } from "#/operation-node/select-query-node";
import type { SelectionNode } from "#/operation-node/selection-node";
import type {
  FieldDefinition,
  FieldName,
  ParentObjectName,
  ParentRelationshipFieldName,
  ParentRelationshipName,
  ParentRelationshipNullable,
} from "#/parser/reference-parser";
import type { Selection, SelectExpression } from "#/parser/select-parser";
import type { SalesforceRecordAttributes } from "#/schema";
import type { Simplify } from "#/util/type-utils";

type NextRelationshipDepth<Depth extends readonly unknown[]> = readonly [
  ...Depth,
  unknown,
];

type DirectPolymorphicRelationshipTargets<
  DB,
  TB extends keyof DB,
  Relationship extends string,
> = Relationship extends ParentRelationshipName<DB, TB>
  ? ParentRelationshipFieldName<DB, TB, Relationship> extends infer SourceField extends
      FieldName<DB, TB>
    ? FieldDefinition<DB, TB, SourceField> extends {
        readonly polymorphic: true;
        readonly referenceTo: infer Targets extends string;
      }
      ? Targets
      : never
    : never
  : never;

export type PolymorphicRelationshipTargets<
  DB,
  TB extends keyof DB,
  Reference extends string,
  Depth extends readonly unknown[] = readonly [],
> = Reference extends `${infer Relationship}.${infer ParentReference}`
  ? Depth["length"] extends 4
    ? never
    : Relationship extends ParentRelationshipName<DB, TB>
      ? ParentObjectName<DB, TB, Relationship> extends infer ParentTB extends
          keyof DB
        ? PolymorphicRelationshipTargets<
            DB,
            ParentTB,
            ParentReference,
            NextRelationshipDepth<Depth>
          >
        : never
      : never
  : DirectPolymorphicRelationshipTargets<DB, TB, Reference>;

export type PolymorphicRelationshipReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends unknown
  ? [PolymorphicRelationshipTargets<DB, TB, Reference>] extends [never]
    ? never
    : Reference
  : never;

export type KnownPolymorphicTarget<
  DB,
  Targets extends string,
> = Extract<Targets, keyof DB & string>;

export type TypeOfBranchSelection<
  DB,
  ObjectName extends keyof DB & string,
  SE,
> = Simplify<
  {
    readonly attributes: SalesforceRecordAttributes<ObjectName>;
  } & Selection<DB, ObjectName, SE>
>;

export type TypeOfElseSelectExpression<
  DB,
  Targets extends string,
  SE extends string,
> = Exclude<Targets, keyof DB & string> extends never
  ? [Targets] extends [keyof DB]
    ? SelectExpression<DB, Targets, SE>
    : never
  : never;

export type TypeOfElseSelection<DB, Targets extends string, SE> =
  Targets extends keyof DB & string
    ? TypeOfBranchSelection<DB, Targets, SE>
    : never;

type RelationshipPathAlreadySelected<O, Reference extends string> =
  Reference extends `${infer Relationship}.${infer ParentReference}`
    ? Relationship extends keyof O
      ? RelationshipPathAlreadySelected<
          NonNullable<O[Relationship]>,
          ParentReference
        >
      : false
    : Reference extends keyof O
      ? true
      : false;

type IsTypeOfRelationshipValue<Value> = [NonNullable<Value>] extends [
  { readonly attributes: SalesforceRecordAttributes<string> },
]
  ? true
  : false;

export type TraversesTypeOfRelationship<O, Reference extends string> =
  Reference extends `${infer Relationship}.${infer ParentReference}`
    ? Relationship extends keyof O
      ? IsTypeOfRelationshipValue<O[Relationship]> extends true
        ? true
        : TraversesTypeOfRelationship<
            NonNullable<O[Relationship]>,
            ParentReference
          >
      : false
    : false;

export type AvailableTypeOfReference<O, Reference extends string> =
  RelationshipPathAlreadySelected<O, Reference> extends true
    ? never
    : TraversesTypeOfRelationship<O, Reference> extends true
      ? never
      : unknown;

export type TypeOfSelection<
  DB,
  TB extends keyof DB,
  Reference extends string,
  Value,
> = Reference extends `${infer Relationship}.${infer ParentReference}`
  ? Relationship extends ParentRelationshipName<DB, TB>
    ? ParentObjectName<DB, TB, Relationship> extends infer ParentTB extends
        keyof DB
      ? {
          readonly [Key in Relationship]: true extends ParentRelationshipNullable<
            DB,
            TB,
            Relationship
          >
            ? TypeOfSelection<DB, ParentTB, ParentReference, Value> | null
            : TypeOfSelection<DB, ParentTB, ParentReference, Value>;
        }
      : never
    : never
  : Reference extends ParentRelationshipName<DB, TB>
    ? {
        readonly [Key in Reference]: true extends ParentRelationshipNullable<
          DB,
          TB,
          Reference
        >
          ? Value | null
          : Value;
      }
    : never;

const TYPEOF_FUNCTION_COMPATIBILITY_ERROR =
  "SOQL TYPEOF cannot be combined with SELECT functions, GROUP BY, or HAVING.";

const selectionContainsFunction = (selection: SelectionNode): boolean => {
  switch (selection.selection.kind) {
    case "AggregateFunctionNode":
    case "AliasNode":
    case "DateFunctionNode":
      return true;
    case "RelationshipSubqueryNode":
      return (selection.selection.selections ?? []).some(
        selectionContainsFunction,
      );
    default:
      return false;
  }
};

export function validateTypeOfSelections(queryNode: SelectQueryNode): void {
  const selections = queryNode.selections ?? [];
  const typeOfSelections = selections.flatMap((selection) =>
    selection.selection.kind === "TypeOfNode" ? [selection.selection] : [],
  );

  if (typeOfSelections.length === 0) {
    return;
  }

  if (
    selections.some(selectionContainsFunction) ||
    queryNode.groupBy ||
    queryNode.having
  ) {
    throw new TypeError(TYPEOF_FUNCTION_COMPATIBILITY_ERROR);
  }

  const references = new Set<string>();

  for (const typeOf of typeOfSelections) {
    if (references.has(typeOf.reference.name)) {
      throw new TypeError(
        `Duplicate SOQL TYPEOF relationship: ${typeOf.reference.name}.`,
      );
    }
    references.add(typeOf.reference.name);

    const prefix = `${typeOf.reference.name}.`;
    if (
      selections.some(
        (selection) =>
          selection.selection.kind === "ReferenceNode" &&
          selection.selection.name.startsWith(prefix),
      )
    ) {
      throw new TypeError(
        `SOQL TYPEOF relationship ${typeOf.reference.name} cannot also be referenced in the SELECT field list.`,
      );
    }
  }
}
