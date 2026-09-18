import { AggregateFunctionNode } from "#/operation-node/aggregate-function-node";
import { AliasNode } from "#/operation-node/alias-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import type {
  ComparisonOperator,
  EqualityComparisonOperator,
  OrderedComparisonOperator,
  SetComparisonOperator,
} from "#/operation-node/operator-node";
import type {
  ComparisonOperatorExpression,
} from "#/parser/binary-operation-parser";
import type { FieldReferenceDefinition } from "#/parser/reference-parser";
import { parseSelectionAlias } from "#/parser/selection-alias-parser";
import type {
  SalesforceFieldFilterValue,
  SalesforceFieldValue,
} from "#/schema";
import { freeze } from "#/util/object-utils";

export type AggregatableFieldReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends unknown
  ? [FieldReferenceDefinition<DB, TB, Reference>] extends [never]
    ? never
    : FieldReferenceDefinition<DB, TB, Reference> extends {
          readonly aggregatable: true;
        }
      ? Reference
      : never
  : never;

type SalesforceTypeOfReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = FieldReferenceDefinition<DB, TB, Reference> extends {
  readonly salesforceType: infer SalesforceType extends string;
}
  ? SalesforceType
  : never;

type NumericAggregateSalesforceType = "currency" | "double" | "int" | "percent";

export type NumericAggregatableFieldReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends AggregatableFieldReference<DB, TB, Reference>
  ? SalesforceTypeOfReference<
      DB,
      TB,
      Reference
    > extends NumericAggregateSalesforceType
    ? Reference
    : never
  : never;

type AggregateFieldValue<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = NonNullable<
  SalesforceFieldValue<FieldReferenceDefinition<DB, TB, Reference>>
> | null;

type AggregateFieldComparisonValue<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = SalesforceFieldFilterValue<FieldReferenceDefinition<DB, TB, Reference>>;

type AggregateFieldComparisonOperator<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = ComparisonOperatorExpression<DB, TB, Reference>;

type NumericAggregateOperator =
  | EqualityComparisonOperator
  | OrderedComparisonOperator
  | SetComparisonOperator;

export interface AggregateFunctionExpression<
  Output,
  ComparisonValue = unknown,
  Operator extends ComparisonOperator = ComparisonOperator,
> {
  readonly expressionType: Output | undefined;
  readonly comparisonValueType?: ComparisonValue;
  readonly comparisonOperatorType?: Operator;

  toOperationNode(): AggregateFunctionNode;
}

export interface CountAllFunctionBuilder
  extends AggregateFunctionExpression<
    number,
    number,
    | EqualityComparisonOperator
    | OrderedComparisonOperator
    | SetComparisonOperator
  > {}

export interface AggregateFunctionBuilder<
  Output,
  ComparisonValue = unknown,
  Operator extends ComparisonOperator = ComparisonOperator,
> extends AggregateFunctionExpression<Output, ComparisonValue, Operator> {
  as<Alias extends string>(
    alias: Alias,
  ): AliasedAggregateFunctionBuilder<Output, Alias>;
}

export interface AliasedAggregateFunctionBuilder<
  Output,
  Alias extends string,
> {
  readonly expressionType: Output | undefined;
  readonly alias: Alias | undefined;

  toOperationNode(): AliasNode;
}

class CountAllFunctionBuilderImpl implements CountAllFunctionBuilder {
  readonly #node = AggregateFunctionNode.create("count");

  get expressionType(): number | undefined {
    return undefined;
  }

  toOperationNode(): AggregateFunctionNode {
    return this.#node;
  }
}

class AggregateFunctionBuilderImpl<
  Output,
  ComparisonValue,
  Operator extends ComparisonOperator,
> implements AggregateFunctionBuilder<Output, ComparisonValue, Operator>
{
  readonly #node: AggregateFunctionNode;

  constructor(node: AggregateFunctionNode) {
    this.#node = node;
  }

  get expressionType(): Output | undefined {
    return undefined;
  }

  as<Alias extends string>(
    alias: Alias,
  ): AliasedAggregateFunctionBuilder<Output, Alias> {
    return new AliasedAggregateFunctionBuilderImpl<Output, Alias>(
      this.#node,
      parseSelectionAlias(alias) as Alias,
    );
  }

  toOperationNode(): AggregateFunctionNode {
    return this.#node;
  }
}

class AliasedAggregateFunctionBuilderImpl<
  Output,
  Alias extends string,
> implements AliasedAggregateFunctionBuilder<Output, Alias>
{
  readonly #node: AliasNode;
  readonly #alias: Alias;

  constructor(node: AggregateFunctionNode, alias: Alias) {
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

export interface AggregateFunctionModule<DB, TB extends keyof DB> {
  count(): CountAllFunctionBuilder;

  count<Reference extends string>(
    field: Reference & AggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<number, number, NumericAggregateOperator>;

  countDistinct<Reference extends string>(
    field: Reference & AggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<number, number, NumericAggregateOperator>;

  avg<Reference extends string>(
    field: Reference & NumericAggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<
    number | null,
    number | null,
    NumericAggregateOperator
  >;

  max<Reference extends string>(
    field: Reference & AggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<
    AggregateFieldValue<DB, TB, Reference>,
    AggregateFieldComparisonValue<DB, TB, Reference>,
    AggregateFieldComparisonOperator<DB, TB, Reference>
  >;

  min<Reference extends string>(
    field: Reference & AggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<
    AggregateFieldValue<DB, TB, Reference>,
    AggregateFieldComparisonValue<DB, TB, Reference>,
    AggregateFieldComparisonOperator<DB, TB, Reference>
  >;

  sum<Reference extends string>(
    field: Reference & NumericAggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<
    number | null,
    number | null,
    NumericAggregateOperator
  >;
}

class AggregateFunctionModuleImpl<DB, TB extends keyof DB>
  implements AggregateFunctionModule<DB, TB>
{
  count(): CountAllFunctionBuilder;
  count<Reference extends string>(
    field: Reference & AggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<number, number, NumericAggregateOperator>;
  count(
    field?: string,
  ):
    | CountAllFunctionBuilder
    | AggregateFunctionBuilder<number, number, NumericAggregateOperator> {
    return field === undefined
      ? new CountAllFunctionBuilderImpl()
      : new AggregateFunctionBuilderImpl<
          number,
          number,
          NumericAggregateOperator
        >(
          AggregateFunctionNode.create("count", ReferenceNode.create(field)),
        );
  }

  countDistinct<Reference extends string>(
    field: Reference & AggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<number, number, NumericAggregateOperator> {
    return new AggregateFunctionBuilderImpl<
      number,
      number,
      NumericAggregateOperator
    >(
      AggregateFunctionNode.create(
        "countDistinct",
        ReferenceNode.create(field),
      ),
    );
  }

  avg<Reference extends string>(
    field: Reference & NumericAggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<
    number | null,
    number | null,
    NumericAggregateOperator
  > {
    return new AggregateFunctionBuilderImpl<
      number | null,
      number | null,
      NumericAggregateOperator
    >(
      AggregateFunctionNode.create("avg", ReferenceNode.create(field)),
    );
  }

  max<Reference extends string>(
    field: Reference & AggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<
    AggregateFieldValue<DB, TB, Reference>,
    AggregateFieldComparisonValue<DB, TB, Reference>,
    AggregateFieldComparisonOperator<DB, TB, Reference>
  > {
    return new AggregateFunctionBuilderImpl<
      AggregateFieldValue<DB, TB, Reference>,
      AggregateFieldComparisonValue<DB, TB, Reference>,
      AggregateFieldComparisonOperator<DB, TB, Reference>
    >(AggregateFunctionNode.create("max", ReferenceNode.create(field)));
  }

  min<Reference extends string>(
    field: Reference & AggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<
    AggregateFieldValue<DB, TB, Reference>,
    AggregateFieldComparisonValue<DB, TB, Reference>,
    AggregateFieldComparisonOperator<DB, TB, Reference>
  > {
    return new AggregateFunctionBuilderImpl<
      AggregateFieldValue<DB, TB, Reference>,
      AggregateFieldComparisonValue<DB, TB, Reference>,
      AggregateFieldComparisonOperator<DB, TB, Reference>
    >(AggregateFunctionNode.create("min", ReferenceNode.create(field)));
  }

  sum<Reference extends string>(
    field: Reference & NumericAggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<
    number | null,
    number | null,
    NumericAggregateOperator
  > {
    return new AggregateFunctionBuilderImpl<
      number | null,
      number | null,
      NumericAggregateOperator
    >(
      AggregateFunctionNode.create("sum", ReferenceNode.create(field)),
    );
  }
}

export interface SelectExpressionBuilder<DB, TB extends keyof DB> {
  readonly fn: AggregateFunctionModule<DB, TB>;
}

export function createSelectExpressionBuilder<
  DB,
  TB extends keyof DB,
>(): SelectExpressionBuilder<DB, TB> {
  return freeze({
    fn: new AggregateFunctionModuleImpl<DB, TB>(),
  });
}
