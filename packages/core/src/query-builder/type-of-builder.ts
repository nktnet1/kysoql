import { ReferenceNode } from "#src/operation-node/reference-node";
import { TypeOfNode } from "#src/operation-node/type-of-node";
import type { FieldReference } from "#src/parser/reference-parser";
import type {
  KnownPolymorphicTarget,
  TypeOfBranchSelection,
  TypeOfElseSelectExpression,
  TypeOfElseSelection,
} from "#src/parser/type-of-parser";
import { freeze } from "#src/util/object-utils";

declare const typeOfBuilderType: unique symbol;

/** Field list accepted by a TYPEOF WHEN branch. */
export type TypeOfFieldList<
  DB,
  TB extends keyof DB,
  SE extends string,
> = readonly [
  SE & FieldReference<DB, TB, SE>,
  ...(SE & FieldReference<DB, TB, SE>)[],
];

/** Field list accepted by a TYPEOF ELSE branch. */
export type TypeOfElseFieldList<
  DB,
  Targets extends string,
  SE extends string,
> = readonly [
  SE & TypeOfElseSelectExpression<DB, Targets, SE>,
  ...(SE & TypeOfElseSelectExpression<DB, Targets, SE>)[],
];

/** Builder for Salesforce TYPEOF polymorphic relationship selections. */
export interface TypeOfBuilder<DB, Targets extends string> {
  /** Adds a `WHEN` branch for one target of a polymorphic `TYPEOF` expression. */
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

/** TYPEOF builder after adding a WHEN branch. */
export interface TypeOfWhenBuilder<
  DB,
  Targets extends string,
  Handled extends string,
  Output,
> {
  /** Type-only brand used by Kysoql to preserve compile-time information; it has no user-facing runtime meaning. */
  readonly [typeOfBuilderType]: {
    /** Schema type carried through `TYPEOF` inference. */
    readonly db: DB;
    /** Polymorphic target object names available to this builder. */
    readonly targets: Targets;
    /** Target object names already covered by `WHEN` branches. */
    readonly handled: Handled;
    /** Result type accumulated from completed branches. */
    readonly output: Output;
    /** Indicates that an `ELSE` branch has not yet been added. */
    readonly hasElse: false;
  };

  /** Adds a `WHEN` branch for one target of a polymorphic `TYPEOF` expression. */
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

  /** Adds the `ELSE` selections for a `TYPEOF` expression. */
  else<SE extends string>(
    selections: TypeOfElseFieldList<DB, Exclude<Targets, Handled>, SE>,
  ): TypeOfElseBuilder<
    DB,
    Targets,
    Handled,
    Output | TypeOfElseSelection<DB, Exclude<Targets, Handled>, SE>
  >;

  /** Returns the immutable operation node represented by this builder. */
  toOperationNode(): TypeOfNode;
}

/** Completed TYPEOF builder after adding an ELSE branch. */
export interface TypeOfElseBuilder<
  DB,
  Targets extends string,
  Handled extends string,
  Output,
> {
  /** Type-only brand used by Kysoql to preserve compile-time information; it has no user-facing runtime meaning. */
  readonly [typeOfBuilderType]: {
    /** Schema type carried through `TYPEOF` inference. */
    readonly db: DB;
    /** Polymorphic target object names available to this builder. */
    readonly targets: Targets;
    /** Target object names covered by explicit `WHEN` branches. */
    readonly handled: Handled;
    /** Result type accumulated from all `TYPEOF` branches. */
    readonly output: Output;
    /** Indicates that the terminal `ELSE` branch has been added. */
    readonly hasElse: true;
  };

  /** Returns the immutable operation node represented by this builder. */
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
