import { AliasNode } from "#/operation-node/alias-node";
import {
  DistanceFunctionNode,
  type DistanceUnit,
} from "#/operation-node/distance-function-node";
import { GeolocationFunctionNode } from "#/operation-node/geolocation-function-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import type {
  FieldReferenceDefinition,
  FieldReferenceNullable,
} from "#/parser/reference-parser";
import { parseSelectionAlias } from "#/parser/selection-alias-parser";
import { freeze } from "#/util/object-utils";

declare const distanceFunctionCapabilitiesType: unique symbol;
declare const distanceFunctionSelectionType: unique symbol;

export type LocationFieldReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends unknown
  ? [FieldReferenceDefinition<DB, TB, Reference>] extends [never]
    ? never
    : FieldReferenceDefinition<DB, TB, Reference> extends {
          readonly salesforceType: "location";
        }
      ? Reference
      : never
  : never;

export type FilterableLocationFieldReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends LocationFieldReference<DB, TB, Reference>
  ? FieldReferenceDefinition<DB, TB, Reference> extends {
      readonly filterable: true;
    }
    ? Reference
    : never
  : never;

type ReferenceFilterable<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = FieldReferenceDefinition<DB, TB, Reference> extends {
  readonly filterable: infer Filterable extends boolean;
}
  ? Filterable
  : false;

type ReferenceSortable<DB, TB extends keyof DB, Reference extends string> =
  FieldReferenceDefinition<DB, TB, Reference> extends {
    readonly sortable: infer Sortable extends boolean;
  }
    ? Sortable
    : false;

type BothTrue<Left extends boolean, Right extends boolean> = Left extends true
  ? Right extends true
    ? true
    : false
  : false;

type DistanceFieldOutput<
  DB,
  TB extends keyof DB,
  First extends string,
  Second extends string,
> = true extends
  | FieldReferenceNullable<DB, TB, First>
  | FieldReferenceNullable<DB, TB, Second>
  ? number | null
  : number;

type DistanceLiteralOutput<
  DB,
  TB extends keyof DB,
  First extends string,
> = true extends FieldReferenceNullable<DB, TB, First> ? number | null : number;

export interface GeolocationFunctionBuilder {
  toOperationNode(): GeolocationFunctionNode;
}

export interface DistanceFunctionExpression<
  Output,
  Filterable extends boolean,
  Sortable extends boolean,
> {
  readonly expressionType: Output | undefined;
  readonly [distanceFunctionCapabilitiesType]: {
    readonly filterable: Filterable;
    readonly sortable: Sortable;
  };

  toOperationNode(): DistanceFunctionNode;
}

export interface DistanceFunctionBuilder<
  Output,
  Filterable extends boolean,
  Sortable extends boolean,
> extends DistanceFunctionExpression<Output, Filterable, Sortable> {
  as<Alias extends string>(
    alias: Alias,
  ): AliasedDistanceFunctionBuilder<Output, Alias>;
}

export interface AliasedDistanceFunctionBuilder<
  Output,
  Alias extends string,
> {
  readonly expressionType: Output | undefined;
  readonly alias: Alias | undefined;
  readonly [distanceFunctionSelectionType]: true;

  toOperationNode(): AliasNode;
}

export interface GeolocationFunctionModule<DB, TB extends keyof DB> {
  geolocation(latitude: number, longitude: number): GeolocationFunctionBuilder;

  distance<First extends string>(
    location: First & LocationFieldReference<DB, TB, First>,
    destination: GeolocationFunctionBuilder,
    unit: DistanceUnit,
  ): DistanceFunctionBuilder<
    DistanceLiteralOutput<DB, TB, First>,
    ReferenceFilterable<DB, TB, First>,
    ReferenceSortable<DB, TB, First>
  >;

  distance<First extends string, Second extends string>(
    location: First & LocationFieldReference<DB, TB, First>,
    destination: Second & LocationFieldReference<DB, TB, Second>,
    unit: DistanceUnit,
  ): DistanceFunctionBuilder<
    DistanceFieldOutput<DB, TB, First, Second>,
    BothTrue<
      ReferenceFilterable<DB, TB, First>,
      ReferenceFilterable<DB, TB, Second>
    >,
    BothTrue<
      ReferenceSortable<DB, TB, First>,
      ReferenceSortable<DB, TB, Second>
    >
  >;
}

export interface GeolocationFilterFunctionModule<DB, TB extends keyof DB> {
  geolocation(latitude: number, longitude: number): GeolocationFunctionBuilder;

  distance<First extends string>(
    location: First & FilterableLocationFieldReference<DB, TB, First>,
    destination: GeolocationFunctionBuilder,
    unit: DistanceUnit,
  ): DistanceFunctionExpression<number | null, true, boolean>;

  distance<First extends string, Second extends string>(
    location: First & FilterableLocationFieldReference<DB, TB, First>,
    destination: Second & FilterableLocationFieldReference<DB, TB, Second>,
    unit: DistanceUnit,
  ): DistanceFunctionExpression<number | null, true, boolean>;
}

class GeolocationFunctionBuilderImpl implements GeolocationFunctionBuilder {
  readonly #node: GeolocationFunctionNode;

  constructor(node: GeolocationFunctionNode) {
    this.#node = node;
  }

  toOperationNode(): GeolocationFunctionNode {
    return this.#node;
  }
}

class DistanceFunctionBuilderImpl<
  Output,
  Filterable extends boolean,
  Sortable extends boolean,
> implements DistanceFunctionBuilder<Output, Filterable, Sortable>
{
  declare readonly [distanceFunctionCapabilitiesType]: {
    readonly filterable: Filterable;
    readonly sortable: Sortable;
  };

  readonly #node: DistanceFunctionNode;

  constructor(node: DistanceFunctionNode) {
    this.#node = node;
  }

  get expressionType(): Output | undefined {
    return undefined;
  }

  as<Alias extends string>(
    alias: Alias,
  ): AliasedDistanceFunctionBuilder<Output, Alias> {
    return new AliasedDistanceFunctionBuilderImpl<Output, Alias>(
      this.#node,
      parseSelectionAlias(alias) as Alias,
    );
  }

  toOperationNode(): DistanceFunctionNode {
    return this.#node;
  }
}

class AliasedDistanceFunctionBuilderImpl<Output, Alias extends string>
  implements AliasedDistanceFunctionBuilder<Output, Alias>
{
  declare readonly [distanceFunctionSelectionType]: true;

  readonly #node: AliasNode;
  readonly #alias: Alias;

  constructor(node: DistanceFunctionNode, alias: Alias) {
    this.#node = AliasNode.create(node, alias);
    this.#alias = alias;
  }

  get expressionType(): Output | undefined {
    return undefined;
  }

  get alias(): Alias | undefined {
    return this.#alias;
  }

  toOperationNode(): AliasNode {
    return this.#node;
  }
}

export class GeolocationFunctionModuleImpl<DB, TB extends keyof DB>
  implements GeolocationFunctionModule<DB, TB>
{
  geolocation(latitude: number, longitude: number): GeolocationFunctionBuilder {
    return new GeolocationFunctionBuilderImpl(
      GeolocationFunctionNode.create(latitude, longitude),
    );
  }

  distance<First extends string>(
    location: First & LocationFieldReference<DB, TB, First>,
    destination: GeolocationFunctionBuilder,
    unit: DistanceUnit,
  ): DistanceFunctionBuilder<
    DistanceLiteralOutput<DB, TB, First>,
    ReferenceFilterable<DB, TB, First>,
    ReferenceSortable<DB, TB, First>
  >;
  distance<First extends string, Second extends string>(
    location: First & LocationFieldReference<DB, TB, First>,
    destination: Second & LocationFieldReference<DB, TB, Second>,
    unit: DistanceUnit,
  ): DistanceFunctionBuilder<
    DistanceFieldOutput<DB, TB, First, Second>,
    BothTrue<
      ReferenceFilterable<DB, TB, First>,
      ReferenceFilterable<DB, TB, Second>
    >,
    BothTrue<
      ReferenceSortable<DB, TB, First>,
      ReferenceSortable<DB, TB, Second>
    >
  >;
  distance(
    location: string,
    destination: string | GeolocationFunctionBuilder,
    unit: DistanceUnit,
  ): DistanceFunctionBuilder<number | null, boolean, boolean> {
    if (typeof location !== "string") {
      throw new TypeError(
        "SOQL DISTANCE() requires a location field reference as its first argument.",
      );
    }

    const destinationNode =
      typeof destination === "string"
        ? ReferenceNode.create(destination)
        : destination.toOperationNode();

    if (
      destinationNode.kind !== "ReferenceNode" &&
      destinationNode.kind !== "GeolocationFunctionNode"
    ) {
      throw new TypeError(
        "SOQL DISTANCE() requires a location field reference or GEOLOCATION() expression as its second argument.",
      );
    }

    return new DistanceFunctionBuilderImpl<number | null, boolean, boolean>(
      DistanceFunctionNode.create(
        ReferenceNode.create(location),
        destinationNode,
        unit,
      ),
    );
  }
}

export interface GeolocationFilterExpressionBuilder<DB, TB extends keyof DB> {
  readonly fn: GeolocationFilterFunctionModule<DB, TB>;
}

export function createGeolocationFilterExpressionBuilder<
  DB,
  TB extends keyof DB,
>(): GeolocationFilterExpressionBuilder<DB, TB> {
  return freeze({
    fn: new GeolocationFunctionModuleImpl<DB, TB>() as unknown as GeolocationFilterFunctionModule<
      DB,
      TB
    >,
  });
}

export interface GeolocationExpressionBuilder<DB, TB extends keyof DB> {
  readonly fn: GeolocationFunctionModule<DB, TB>;
}

export function createGeolocationExpressionBuilder<DB, TB extends keyof DB>(): GeolocationExpressionBuilder<
  DB,
  TB
> {
  return freeze({
    fn: new GeolocationFunctionModuleImpl<DB, TB>(),
  });
}
