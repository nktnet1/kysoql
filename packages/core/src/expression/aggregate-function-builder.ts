import { AggregateFunctionNode } from "#/operation-node/aggregate-function-node";
import { AliasNode } from "#/operation-node/alias-node";
import { ConvertCurrencyFunctionNode } from "#/operation-node/convert-currency-function-node";
import {
  type DateFunction,
  DateFunctionNode,
} from "#/operation-node/date-function-node";
import { FormatFunctionNode } from "#/operation-node/format-function-node";
import type {
  ComparisonOperator,
  EqualityComparisonOperator,
  OrderedComparisonOperator,
  SetComparisonOperator,
} from "#/operation-node/operator-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { ToLabelFunctionNode } from "#/operation-node/to-label-function-node";
import type { ComparisonOperatorExpression } from "#/parser/binary-operation-parser";
import type { GroupableFieldName } from "#/parser/group-by-parser";
import { validateGroupingField } from "#/parser/grouping-expression-parser";
import type {
  FieldReferenceDefinition,
  FieldReferenceNullable,
} from "#/parser/reference-parser";
import { parseSelectionAlias } from "#/parser/selection-alias-parser";
import type {
  SalesforceFieldFilterValue,
  SalesforceFieldValue,
} from "#/schema";
import type { SoqlDateLiteral } from "#/soql-temporal-literal";
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
> =
  FieldReferenceDefinition<DB, TB, Reference> extends {
    readonly salesforceType: infer SalesforceType extends string;
  }
    ? SalesforceType
    : never;

type NumericAggregateSalesforceType = "currency" | "double" | "int" | "percent";

export type NumericAggregatableFieldReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> =
  Reference extends AggregatableFieldReference<DB, TB, Reference>
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

type TemporalSalesforceType = "date" | "datetime";
type TranslatableSalesforceType = "multipicklist" | "picklist";
type FormattableSalesforceType =
  | NumericAggregateSalesforceType
  | TemporalSalesforceType
  | "time";

export type DateGroupableFieldReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
  SalesforceType extends TemporalSalesforceType = TemporalSalesforceType,
> =
  Reference extends GroupableFieldName<DB, TB, Reference>
    ? SalesforceTypeOfReference<DB, TB, Reference> extends SalesforceType
      ? Reference
      : never
    : never;

type DateFunctionOutput<
  DB,
  TB extends keyof DB,
  Reference extends string,
  Output,
> =
  true extends FieldReferenceNullable<DB, TB, Reference>
    ? Output | null
    : Output;

type DateFunctionComparisonValue<
  DB,
  TB extends keyof DB,
  Reference extends string,
  Value,
> =
  true extends FieldReferenceNullable<DB, TB, Reference> ? Value | null : Value;

declare const groupingFunctionType: unique symbol;
declare const dateFunctionIdentityType: unique symbol;
declare const aggregateFunctionSelectionType: unique symbol;
declare const selectFunctionSelectionType: unique symbol;

export type DateFunctionIdentity<
  Function extends DateFunction,
  Reference extends string,
> = `${Function}(${Reference})`;

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

export interface DateFunctionExpression<
  Output,
  ComparisonValue,
  Operator extends ComparisonOperator,
  Identity extends string,
> {
  readonly expressionType: Output | undefined;
  readonly comparisonValueType?: ComparisonValue;
  readonly comparisonOperatorType?: Operator;
  readonly [dateFunctionIdentityType]: Identity;

  toOperationNode(): DateFunctionNode;
}

export interface DateFunctionBuilder<
  Output,
  ComparisonValue,
  Operator extends ComparisonOperator,
  Identity extends string,
> extends DateFunctionExpression<Output, ComparisonValue, Operator, Identity> {
  as<Alias extends string>(
    alias: Alias,
  ): AliasedDateFunctionBuilder<Output, Alias, Identity>;
}

export interface AliasedDateFunctionBuilder<
  Output,
  Alias extends string,
  Identity extends string,
> {
  readonly expressionType: Output | undefined;
  readonly alias: Alias | undefined;
  readonly [dateFunctionIdentityType]: Identity;

  toOperationNode(): AliasNode;
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

export interface GroupingFunctionBuilder
  extends AggregateFunctionBuilder<0 | 1, 0 | 1, NumericAggregateOperator> {
  readonly [groupingFunctionType]: true;
}

export interface AliasedAggregateFunctionBuilder<Output, Alias extends string> {
  readonly expressionType: Output | undefined;
  readonly alias: Alias | undefined;
  readonly [aggregateFunctionSelectionType]: true;

  toOperationNode(): AliasNode;
}

export type TranslatableFieldReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends unknown
  ? [FieldReferenceDefinition<DB, TB, Reference>] extends [never]
    ? never
    : FieldReferenceDefinition<DB, TB, Reference> extends {
          readonly salesforceType: TranslatableSalesforceType;
        }
      ? Reference
      : never
  : never;

export type CurrencyFieldReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends unknown
  ? [FieldReferenceDefinition<DB, TB, Reference>] extends [never]
    ? never
    : FieldReferenceDefinition<DB, TB, Reference> extends {
          readonly salesforceType: "currency";
        }
      ? Reference
      : never
  : never;

export type FormattableFieldReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends unknown
  ? [FieldReferenceDefinition<DB, TB, Reference>] extends [never]
    ? never
    : SalesforceTypeOfReference<
          DB,
          TB,
          Reference
        > extends FormattableSalesforceType
      ? Reference
      : never
  : never;

type ConvertCurrencyOutput<DB, TB extends keyof DB, Reference extends string> =
  true extends FieldReferenceNullable<DB, TB, Reference>
    ? number | null
    : number;

type FormatOutput<DB, TB extends keyof DB, Reference extends string> =
  true extends FieldReferenceNullable<DB, TB, Reference>
    ? string | null
    : string;

type NestedFormatOutput<Output> = null extends Output ? string | null : string;

type ToLabelOutput<DB, TB extends keyof DB, Reference extends string> =
  true extends FieldReferenceNullable<DB, TB, Reference>
    ? string | null
    : string;

export interface ToLabelFunctionBuilder<Output> {
  readonly expressionType: Output | undefined;

  as<Alias extends string>(
    alias: Alias,
  ): AliasedSelectFunctionBuilder<Output, Alias>;

  toOperationNode(): ToLabelFunctionNode;
}

export interface ConvertCurrencyFunctionBuilder<Output> {
  readonly expressionType: Output | undefined;

  as<Alias extends string>(
    alias: Alias,
  ): AliasedSelectFunctionBuilder<Output, Alias>;

  toOperationNode(): ConvertCurrencyFunctionNode;
}

export interface FormatFunctionBuilder<Output> {
  readonly expressionType: Output | undefined;

  as<Alias extends string>(
    alias: Alias,
  ): AliasedSelectFunctionBuilder<Output, Alias>;

  toOperationNode(): FormatFunctionNode;
}

export interface AliasedSelectFunctionBuilder<Output, Alias extends string> {
  readonly expressionType: Output | undefined;
  readonly alias: Alias | undefined;
  readonly [selectFunctionSelectionType]: true;

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

class GroupingFunctionBuilderImpl
  extends AggregateFunctionBuilderImpl<0 | 1, 0 | 1, NumericAggregateOperator>
  implements GroupingFunctionBuilder
{
  declare readonly [groupingFunctionType]: true;
}

class DateFunctionBuilderImpl<
  Output,
  ComparisonValue,
  Operator extends ComparisonOperator,
  Identity extends string,
> implements DateFunctionBuilder<Output, ComparisonValue, Operator, Identity>
{
  declare readonly [dateFunctionIdentityType]: Identity;

  readonly #node: DateFunctionNode;

  constructor(node: DateFunctionNode) {
    this.#node = node;
  }

  get expressionType(): Output | undefined {
    return undefined;
  }

  as<Alias extends string>(
    alias: Alias,
  ): AliasedDateFunctionBuilder<Output, Alias, Identity> {
    return new AliasedDateFunctionBuilderImpl<Output, Alias, Identity>(
      this.#node,
      parseSelectionAlias(alias) as Alias,
    );
  }

  toOperationNode(): DateFunctionNode {
    return this.#node;
  }
}

class AliasedDateFunctionBuilderImpl<
  Output,
  Alias extends string,
  Identity extends string,
> implements AliasedDateFunctionBuilder<Output, Alias, Identity>
{
  declare readonly [dateFunctionIdentityType]: Identity;

  readonly #node: AliasNode;
  readonly #alias: Alias;

  constructor(node: DateFunctionNode, alias: Alias) {
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

class AliasedAggregateFunctionBuilderImpl<Output, Alias extends string>
  implements AliasedAggregateFunctionBuilder<Output, Alias>
{
  declare readonly [aggregateFunctionSelectionType]: true;

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

class ToLabelFunctionBuilderImpl<Output>
  implements ToLabelFunctionBuilder<Output>
{
  readonly #node: ToLabelFunctionNode;

  constructor(node: ToLabelFunctionNode) {
    this.#node = node;
  }

  get expressionType(): Output | undefined {
    return undefined;
  }

  as<Alias extends string>(
    alias: Alias,
  ): AliasedSelectFunctionBuilder<Output, Alias> {
    return new AliasedSelectFunctionBuilderImpl<Output, Alias>(
      this.#node,
      parseSelectionAlias(alias) as Alias,
    );
  }

  toOperationNode(): ToLabelFunctionNode {
    return this.#node;
  }
}

class ConvertCurrencyFunctionBuilderImpl<Output>
  implements ConvertCurrencyFunctionBuilder<Output>
{
  readonly #node: ConvertCurrencyFunctionNode;

  constructor(node: ConvertCurrencyFunctionNode) {
    this.#node = node;
  }

  get expressionType(): Output | undefined {
    return undefined;
  }

  as<Alias extends string>(
    alias: Alias,
  ): AliasedSelectFunctionBuilder<Output, Alias> {
    return new AliasedSelectFunctionBuilderImpl<Output, Alias>(
      this.#node,
      parseSelectionAlias(alias) as Alias,
    );
  }

  toOperationNode(): ConvertCurrencyFunctionNode {
    return this.#node;
  }
}

class FormatFunctionBuilderImpl<Output>
  implements FormatFunctionBuilder<Output>
{
  readonly #node: FormatFunctionNode;

  constructor(node: FormatFunctionNode) {
    this.#node = node;
  }

  get expressionType(): Output | undefined {
    return undefined;
  }

  as<Alias extends string>(
    alias: Alias,
  ): AliasedSelectFunctionBuilder<Output, Alias> {
    return new AliasedSelectFunctionBuilderImpl<Output, Alias>(
      this.#node,
      parseSelectionAlias(alias) as Alias,
    );
  }

  toOperationNode(): FormatFunctionNode {
    return this.#node;
  }
}

type SelectFunctionNode =
  | ConvertCurrencyFunctionNode
  | FormatFunctionNode
  | ToLabelFunctionNode;

class AliasedSelectFunctionBuilderImpl<Output, Alias extends string>
  implements AliasedSelectFunctionBuilder<Output, Alias>
{
  declare readonly [selectFunctionSelectionType]: true;

  readonly #node: AliasNode;
  readonly #alias: Alias;

  constructor(node: SelectFunctionNode, alias: Alias) {
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

export type GroupingFieldReference<
  DB,
  TB extends keyof DB,
  GroupingFields extends string,
  Reference extends string,
> = Reference extends GroupingFields
  ? GroupableFieldName<DB, TB, Reference>
  : never;

type NumericDateFunctionBuilder<
  DB,
  TB extends keyof DB,
  Function extends DateFunction,
  Reference extends string,
> = DateFunctionBuilder<
  DateFunctionOutput<DB, TB, Reference, number>,
  DateFunctionComparisonValue<DB, TB, Reference, number>,
  NumericAggregateOperator,
  DateFunctionIdentity<Function, Reference>
>;

type DayOnlyFunctionBuilder<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = DateFunctionBuilder<
  DateFunctionOutput<DB, TB, Reference, string>,
  DateFunctionComparisonValue<DB, TB, Reference, SoqlDateLiteral>,
  NumericAggregateOperator,
  DateFunctionIdentity<"dayOnly", Reference>
>;

export interface AggregateFunctionModule<
  DB,
  TB extends keyof DB,
  GroupingFields extends string = never,
> {
  calendarMonth<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "calendarMonth", Reference>;

  calendarQuarter<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "calendarQuarter", Reference>;

  calendarYear<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "calendarYear", Reference>;

  dayInMonth<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "dayInMonth", Reference>;

  dayInWeek<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "dayInWeek", Reference>;

  dayInYear<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "dayInYear", Reference>;

  dayOnly<Reference extends string>(
    field: Reference &
      DateGroupableFieldReference<DB, TB, Reference, "datetime">,
  ): DayOnlyFunctionBuilder<DB, TB, Reference>;

  fiscalMonth<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "fiscalMonth", Reference>;

  fiscalQuarter<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "fiscalQuarter", Reference>;

  fiscalYear<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "fiscalYear", Reference>;

  hourInDay<Reference extends string>(
    field: Reference &
      DateGroupableFieldReference<DB, TB, Reference, "datetime">,
  ): NumericDateFunctionBuilder<DB, TB, "hourInDay", Reference>;

  weekInMonth<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "weekInMonth", Reference>;

  weekInYear<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "weekInYear", Reference>;

  grouping<Reference extends string>(
    field: Reference &
      GroupingFieldReference<DB, TB, GroupingFields, Reference>,
  ): GroupingFunctionBuilder;

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

export interface SelectFunctionModule<
  DB,
  TB extends keyof DB,
  GroupingFields extends string = never,
> extends AggregateFunctionModule<DB, TB, GroupingFields> {
  convertCurrency<Reference extends string>(
    field: Reference & CurrencyFieldReference<DB, TB, Reference>,
  ): ConvertCurrencyFunctionBuilder<ConvertCurrencyOutput<DB, TB, Reference>>;

  format<Reference extends string>(
    field: Reference & FormattableFieldReference<DB, TB, Reference>,
  ): FormatFunctionBuilder<FormatOutput<DB, TB, Reference>>;

  format<Output>(
    expression: ConvertCurrencyFunctionBuilder<Output>,
  ): FormatFunctionBuilder<NestedFormatOutput<Output>>;

  toLabel<Reference extends string>(
    field: Reference & TranslatableFieldReference<DB, TB, Reference>,
  ): ToLabelFunctionBuilder<ToLabelOutput<DB, TB, Reference>>;
}

class AggregateFunctionModuleImpl<
  DB,
  TB extends keyof DB,
  GroupingFields extends string,
> {
  readonly #groupingFields: readonly string[];

  constructor(groupingFields: readonly string[]) {
    this.#groupingFields = freeze([...groupingFields]);
  }

  #numericDateFunction<Function extends DateFunction, Reference extends string>(
    dateFunction: Function,
    reference: Reference,
  ): NumericDateFunctionBuilder<DB, TB, Function, Reference> {
    return new DateFunctionBuilderImpl<
      DateFunctionOutput<DB, TB, Reference, number>,
      DateFunctionComparisonValue<DB, TB, Reference, number>,
      NumericAggregateOperator,
      DateFunctionIdentity<Function, Reference>
    >(DateFunctionNode.create(dateFunction, ReferenceNode.create(reference)));
  }

  #dayOnly<Reference extends string>(
    reference: Reference,
  ): DayOnlyFunctionBuilder<DB, TB, Reference> {
    return new DateFunctionBuilderImpl<
      DateFunctionOutput<DB, TB, Reference, string>,
      DateFunctionComparisonValue<DB, TB, Reference, SoqlDateLiteral>,
      NumericAggregateOperator,
      DateFunctionIdentity<"dayOnly", Reference>
    >(DateFunctionNode.create("dayOnly", ReferenceNode.create(reference)));
  }

  calendarMonth<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "calendarMonth", Reference> {
    return this.#numericDateFunction("calendarMonth", field as Reference);
  }

  calendarQuarter<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "calendarQuarter", Reference> {
    return this.#numericDateFunction("calendarQuarter", field as Reference);
  }

  calendarYear<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "calendarYear", Reference> {
    return this.#numericDateFunction("calendarYear", field as Reference);
  }

  dayInMonth<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "dayInMonth", Reference> {
    return this.#numericDateFunction("dayInMonth", field as Reference);
  }

  dayInWeek<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "dayInWeek", Reference> {
    return this.#numericDateFunction("dayInWeek", field as Reference);
  }

  dayInYear<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "dayInYear", Reference> {
    return this.#numericDateFunction("dayInYear", field as Reference);
  }

  dayOnly<Reference extends string>(
    field: Reference &
      DateGroupableFieldReference<DB, TB, Reference, "datetime">,
  ): DayOnlyFunctionBuilder<DB, TB, Reference> {
    return this.#dayOnly(field as Reference);
  }

  fiscalMonth<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "fiscalMonth", Reference> {
    return this.#numericDateFunction("fiscalMonth", field as Reference);
  }

  fiscalQuarter<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "fiscalQuarter", Reference> {
    return this.#numericDateFunction("fiscalQuarter", field as Reference);
  }

  fiscalYear<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "fiscalYear", Reference> {
    return this.#numericDateFunction("fiscalYear", field as Reference);
  }

  hourInDay<Reference extends string>(
    field: Reference &
      DateGroupableFieldReference<DB, TB, Reference, "datetime">,
  ): NumericDateFunctionBuilder<DB, TB, "hourInDay", Reference> {
    return this.#numericDateFunction("hourInDay", field as Reference);
  }

  weekInMonth<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "weekInMonth", Reference> {
    return this.#numericDateFunction("weekInMonth", field as Reference);
  }

  weekInYear<Reference extends string>(
    field: Reference & DateGroupableFieldReference<DB, TB, Reference>,
  ): NumericDateFunctionBuilder<DB, TB, "weekInYear", Reference> {
    return this.#numericDateFunction("weekInYear", field as Reference);
  }

  convertCurrency<Reference extends string>(
    field: Reference & CurrencyFieldReference<DB, TB, Reference>,
  ): ConvertCurrencyFunctionBuilder<ConvertCurrencyOutput<DB, TB, Reference>> {
    return new ConvertCurrencyFunctionBuilderImpl<
      ConvertCurrencyOutput<DB, TB, Reference>
    >(ConvertCurrencyFunctionNode.create(ReferenceNode.create(field)));
  }

  format<Reference extends string>(
    field: Reference & FormattableFieldReference<DB, TB, Reference>,
  ): FormatFunctionBuilder<FormatOutput<DB, TB, Reference>>;
  format<Output>(
    expression: ConvertCurrencyFunctionBuilder<Output>,
  ): FormatFunctionBuilder<NestedFormatOutput<Output>>;
  format(
    fieldOrExpression: string | ConvertCurrencyFunctionBuilder<unknown>,
  ): FormatFunctionBuilder<string | null> {
    const expression =
      typeof fieldOrExpression === "string"
        ? ReferenceNode.create(fieldOrExpression)
        : fieldOrExpression.toOperationNode();

    if (
      expression.kind !== "ReferenceNode" &&
      expression.kind !== "ConvertCurrencyFunctionNode"
    ) {
      throw new TypeError(
        "SOQL FORMAT() only supports field references or unaliased convertCurrency() expressions.",
      );
    }

    return new FormatFunctionBuilderImpl<string | null>(
      FormatFunctionNode.create(expression),
    );
  }

  toLabel<Reference extends string>(
    field: Reference & TranslatableFieldReference<DB, TB, Reference>,
  ): ToLabelFunctionBuilder<ToLabelOutput<DB, TB, Reference>> {
    return new ToLabelFunctionBuilderImpl<ToLabelOutput<DB, TB, Reference>>(
      ToLabelFunctionNode.create(ReferenceNode.create(field)),
    );
  }

  grouping<Reference extends string>(
    field: Reference &
      GroupingFieldReference<DB, TB, GroupingFields, Reference>,
  ): GroupingFunctionBuilder {
    validateGroupingField(field, this.#groupingFields);

    return new GroupingFunctionBuilderImpl(
      AggregateFunctionNode.create("grouping", ReferenceNode.create(field)),
    );
  }

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
        >(AggregateFunctionNode.create("count", ReferenceNode.create(field)));
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
    >(AggregateFunctionNode.create("avg", ReferenceNode.create(field)));
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
    >(AggregateFunctionNode.create("sum", ReferenceNode.create(field)));
  }
}

export interface SelectExpressionBuilder<
  DB,
  TB extends keyof DB,
  GroupingFields extends string = never,
> {
  readonly fn: SelectFunctionModule<DB, TB, GroupingFields>;
}

export interface SelectExpressionBuilderOptions {
  readonly groupingFields: readonly string[];
}

export function createSelectExpressionBuilder<
  DB,
  TB extends keyof DB,
  GroupingFields extends string = never,
>(
  options: SelectExpressionBuilderOptions = { groupingFields: [] },
): SelectExpressionBuilder<DB, TB, GroupingFields> {
  return freeze({
    fn: new AggregateFunctionModuleImpl<DB, TB, GroupingFields>(
      options.groupingFields,
    ) as unknown as SelectFunctionModule<DB, TB, GroupingFields>,
  });
}
