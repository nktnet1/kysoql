import { ReferenceNode } from "#/operation-node/reference-node";
import { TypeOfNode } from "#/operation-node/type-of-node";
import type { FieldReference } from "#/parser/reference-parser";
import type {
  KnownPolymorphicTarget,
  TypeOfBranchSelection,
  TypeOfElseSelectExpression,
  TypeOfElseSelection,
} from "#/parser/type-of-parser";
import { freeze } from "#/util/object-utils";

declare const typeOfBuilderType: unique symbol;

export type TypeOfFieldList<
  DB,
  TB extends keyof DB,
  SE extends string,
> = readonly [
  SE & FieldReference<DB, TB, SE>,
  ...(SE & FieldReference<DB, TB, SE>)[],
];

export type TypeOfElseFieldList<
  DB,
  Targets extends string,
  SE extends string,
> = readonly [
  SE & TypeOfElseSelectExpression<DB, Targets, SE>,
  ...(SE & TypeOfElseSelectExpression<DB, Targets, SE>)[],
];

export interface TypeOfBuilder<DB, Targets extends string> {
  when<
    ObjectName extends KnownPolymorphicTarget<DB, Targets>,
    SE extends string,
  >(
    object: ObjectName,
    selections: TypeOfFieldList<DB, ObjectName, SE>,
  ): TypeOfWhenBuilder<
    DB,
    Targets,
    ObjectName,
    TypeOfBranchSelection<DB, ObjectName, SE>
  >;
}

export interface TypeOfWhenBuilder<
  DB,
  Targets extends string,
  Handled extends string,
  Output,
> {
  readonly [typeOfBuilderType]: {
    readonly db: DB;
    readonly targets: Targets;
    readonly handled: Handled;
    readonly output: Output;
    readonly hasElse: false;
  };

  when<
    ObjectName extends Exclude<KnownPolymorphicTarget<DB, Targets>, Handled>,
    SE extends string,
  >(
    object: ObjectName,
    selections: TypeOfFieldList<DB, ObjectName, SE>,
  ): TypeOfWhenBuilder<
    DB,
    Targets,
    Handled | ObjectName,
    Output | TypeOfBranchSelection<DB, ObjectName, SE>
  >;

  else<SE extends string>(
    selections: TypeOfElseFieldList<DB, Exclude<Targets, Handled>, SE>,
  ): TypeOfElseBuilder<
    DB,
    Targets,
    Handled,
    Output | TypeOfElseSelection<DB, Exclude<Targets, Handled>, SE>
  >;

  toOperationNode(): TypeOfNode;
}

export interface TypeOfElseBuilder<
  DB,
  Targets extends string,
  Handled extends string,
  Output,
> {
  readonly [typeOfBuilderType]: {
    readonly db: DB;
    readonly targets: Targets;
    readonly handled: Handled;
    readonly output: Output;
    readonly hasElse: true;
  };

  toOperationNode(): TypeOfNode;
}

type TypeOfBuilderMetadata<Builder> = Builder extends {
  readonly [typeOfBuilderType]: infer Metadata;
}
  ? Metadata
  : never;

export type TypeOfBuilderOutput<Builder> =
  TypeOfBuilderMetadata<Builder> extends {
    readonly output: infer Output;
  }
    ? Output
    : never;

export type TypeOfBuilderHandled<Builder> =
  TypeOfBuilderMetadata<Builder> extends {
    readonly handled: infer Handled extends string;
  }
    ? Handled
    : never;

export type TypeOfBuilderHasElse<Builder> =
  TypeOfBuilderMetadata<Builder> extends { readonly hasElse: infer HasElse }
    ? HasElse
    : false;

interface TypeOfBuilderProps {
  readonly node: TypeOfNode;
}

class TypeOfBuilderImpl<
  DB,
  Targets extends string,
  Handled extends string,
  Output,
> {
  declare readonly [typeOfBuilderType]: {
    readonly db: DB;
    readonly targets: Targets;
    readonly handled: Handled;
    readonly output: Output;
    readonly hasElse: boolean;
  };

  readonly #props: TypeOfBuilderProps;

  constructor(props: TypeOfBuilderProps) {
    this.#props = freeze(props);
  }

  when<ObjectName extends string, SE extends string>(
    object: ObjectName,
    selections: readonly SE[],
  ): TypeOfWhenBuilder<DB, Targets, Handled | ObjectName, Output> {
    return new TypeOfBuilderImpl({
      node: TypeOfNode.cloneWithWhen(
        this.#props.node,
        object,
        selections.map(ReferenceNode.create),
      ),
    }) as unknown as TypeOfWhenBuilder<
      DB,
      Targets,
      Handled | ObjectName,
      Output
    >;
  }

  else<SE extends string>(
    selections: readonly SE[],
  ): TypeOfElseBuilder<DB, Targets, Handled, Output> {
    return new TypeOfBuilderImpl({
      node: TypeOfNode.cloneWithElse(
        this.#props.node,
        selections.map(ReferenceNode.create),
      ),
    }) as unknown as TypeOfElseBuilder<DB, Targets, Handled, Output>;
  }

  toOperationNode(): TypeOfNode {
    return this.#props.node;
  }
}

export function createTypeOfBuilder<DB, Targets extends string>(
  reference: ReferenceNode,
): TypeOfBuilder<DB, Targets> {
  return new TypeOfBuilderImpl<DB, Targets, never, never>({
    node: TypeOfNode.create(reference),
  });
}
