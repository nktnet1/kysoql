import {
  type GeolocationFunctionModule,
  GeolocationFunctionModuleImpl,
} from "#/expression/geolocation-function-builder";
import { AggregateFunctionNode } from "#/operation-node/aggregate-function-node";
import { AliasNode } from "#/operation-node/alias-node";
import { ConvertCurrencyFunctionNode } from "#/operation-node/convert-currency-function-node";
import { ConvertTimezoneFunctionNode } from "#/operation-node/convert-timezone-function-node";
import {
  type DateFunction,
  type DateFunctionArgumentNode,
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

/**
 * Restricts a field reference to Salesforce fields that support aggregation.
 */
export type AggregatableFieldReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends unknown
  ? [FieldReferenceDefinition<DB, TB, Reference>] extends [never]
    ? never
    : FieldReferenceDefinition<DB, TB, Reference> extends {
          /** Field metadata must explicitly allow aggregation. */
          readonly aggregatable: true;
          /** Salesforce field type used to exclude geolocation values. */
          readonly salesforceType: infer SalesforceType extends string;
        }
      ? SalesforceType extends "location"
        ? never
        : Reference
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

/**
 * Restricts a field reference to numeric Salesforce fields that support
 * aggregation.
 */
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

/**
 * Restricts a field reference to date or datetime fields that can be
 * grouped.
 */
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
declare const convertTimezoneReferenceType: unique symbol;
declare const aggregateFunctionSelectionType: unique symbol;
declare const selectFunctionSelectionType: unique symbol;

/**
 * Type-level identity used to track a date-function expression through a
 * query.
 */
export type DateFunctionIdentity<
  Function extends DateFunction,
  ArgumentIdentity extends string,
> = `${Function}(${ArgumentIdentity})`;

/** Type-level identity used to track a convertTimezone() expression. */
export type ConvertTimezoneIdentity<Reference extends string> =
  `convertTimezone(${Reference})`;

/**
 * Typed aggregate-function expression that can be selected or compared.
 */
export interface AggregateFunctionExpression<
  Output,
  ComparisonValue = unknown,
  Operator extends ComparisonOperator = ComparisonOperator,
> {
  /** Type-only output marker used for fluent-query inference; implementations do not expose a meaningful runtime value. */
  readonly expressionType: Output | undefined;
  /** Type-only marker for values accepted when comparing this expression. */
  readonly comparisonValueType?: ComparisonValue;
  /** Type-only marker for comparison operators supported by this expression. */
  readonly comparisonOperatorType?: Operator;

  /** Returns the immutable operation node represented by this expression. */
  toOperationNode(): AggregateFunctionNode;
}

/**
 * Typed Salesforce date-function expression that can be selected or grouped.
 */
export interface DateFunctionExpression<
  Output,
  ComparisonValue,
  Operator extends ComparisonOperator,
  Identity extends string,
> {
  /** Type-only output marker used for fluent-query inference; implementations do not expose a meaningful runtime value. */
  readonly expressionType: Output | undefined;
  /** Type-only marker for values accepted when comparing this expression. */
  readonly comparisonValueType?: ComparisonValue;
  /** Type-only marker for comparison operators supported by this expression. */
  readonly comparisonOperatorType?: Operator;
  /** Type-only marker used to preserve this expression capability through TypeScript inference. */
  readonly [dateFunctionIdentityType]: Identity;

  /** Returns the immutable operation node represented by this expression. */
  toOperationNode(): DateFunctionNode;
}

/**
 * Builder for Salesforce date functions such as CALENDAR_YEAR() and
 * DAY_ONLY().
 */
export interface DateFunctionBuilder<
  Output,
  ComparisonValue,
  Operator extends ComparisonOperator,
  Identity extends string,
> extends DateFunctionExpression<Output, ComparisonValue, Operator, Identity> {
  /** Aliases this expression for SELECT output and result mapping. */
  as<Alias extends string>(
    alias: Alias,
  ): AliasedDateFunctionBuilder<Output, Alias, Identity>;
}

/** Builder for an unaliased Salesforce convertTimezone() expression. */
export interface ConvertTimezoneFunctionBuilder<Reference extends string> {
  /** Type-only marker used to preserve this expression capability through TypeScript inference. */
  readonly [convertTimezoneReferenceType]: Reference;

  /** Returns the immutable operation node represented by this expression. */
  toOperationNode(): ConvertTimezoneFunctionNode;
}

/** Aliased date-function expression produced for SELECT output. */
export interface AliasedDateFunctionBuilder<
  Output,
  Alias extends string,
  Identity extends string,
> {
  /** Type-only output marker used for fluent-query inference; implementations do not expose a meaningful runtime value. */
  readonly expressionType: Output | undefined;
  /** Selection alias used as the mapped result property name. */
  readonly alias: Alias | undefined;
  /** Type-only marker used to preserve this expression capability through TypeScript inference. */
  readonly [dateFunctionIdentityType]: Identity;

  /** Returns the immutable operation node represented by this expression. */
  toOperationNode(): AliasNode;
}

/** Builder for Salesforce COUNT() without a field argument. */
export interface CountAllFunctionBuilder
  extends AggregateFunctionExpression<
    number,
    number,
    | EqualityComparisonOperator
    | OrderedComparisonOperator
    | SetComparisonOperator
  > {}

/** Builder for a typed Salesforce aggregate function expression. */
export interface AggregateFunctionBuilder<
  Output,
  ComparisonValue = unknown,
  Operator extends ComparisonOperator = ComparisonOperator,
> extends AggregateFunctionExpression<Output, ComparisonValue, Operator> {
  /** Aliases this expression for SELECT output and result mapping. */
  as<Alias extends string>(
    alias: Alias,
  ): AliasedAggregateFunctionBuilder<Output, Alias>;
}

/** Builder for Salesforce GROUPING() in aggregate queries. */
export interface GroupingFunctionBuilder
  extends AggregateFunctionBuilder<0 | 1, 0 | 1, NumericAggregateOperator> {
  /** Type-only marker used to preserve this expression capability through TypeScript inference. */
  readonly [groupingFunctionType]: true;
}

/** Aliased aggregate expression produced for SELECT output. */
export interface AliasedAggregateFunctionBuilder<Output, Alias extends string> {
  /** Type-only output marker used for fluent-query inference; implementations do not expose a meaningful runtime value. */
  readonly expressionType: Output | undefined;
  /** Selection alias used as the mapped result property name. */
  readonly alias: Alias | undefined;
  /** Type-only marker used to preserve this expression capability through TypeScript inference. */
  readonly [aggregateFunctionSelectionType]: true;

  /** Returns the immutable operation node represented by this expression. */
  toOperationNode(): AliasNode;
}

/** Restricts a field reference to values supported by toLabel(). */
export type TranslatableFieldReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends unknown
  ? [FieldReferenceDefinition<DB, TB, Reference>] extends [never]
    ? never
    : FieldReferenceDefinition<DB, TB, Reference> extends {
          /** Salesforce field type must support translation through `toLabel()`. */
          readonly salesforceType: TranslatableSalesforceType;
        }
      ? Reference
      : never
  : never;

/**
 * Restricts a field reference to currency values supported by
 * convertCurrency().
 */
export type CurrencyFieldReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends unknown
  ? [FieldReferenceDefinition<DB, TB, Reference>] extends [never]
    ? never
    : FieldReferenceDefinition<DB, TB, Reference> extends {
          /** Salesforce field type must be `currency`. */
          readonly salesforceType: "currency";
        }
      ? Reference
      : never
  : never;

/** Restricts a field reference to values supported by FORMAT(). */
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

type FormattableAggregateFunctionBuilder<
  Output,
  ComparisonValue,
  Operator extends ComparisonOperator,
> = AggregateFunctionBuilder<Output, ComparisonValue, Operator> & {
  readonly [groupingFunctionType]?: never;
};

type ToLabelOutput<DB, TB extends keyof DB, Reference extends string> =
  true extends FieldReferenceNullable<DB, TB, Reference>
    ? string | null
    : string;

/** Builder for Salesforce toLabel() expressions. */
export interface ToLabelFunctionBuilder<Output> {
  /** Type-only output marker used for fluent-query inference; implementations do not expose a meaningful runtime value. */
  readonly expressionType: Output | undefined;

  /** Aliases this expression for SELECT output and result mapping. */
  as<Alias extends string>(
    alias: Alias,
  ): AliasedSelectFunctionBuilder<Output, Alias>;

  /** Returns the immutable operation node represented by this expression. */
  toOperationNode(): ToLabelFunctionNode;
}

/** Builder for Salesforce convertCurrency() expressions. */
export interface ConvertCurrencyFunctionBuilder<Output> {
  /** Type-only output marker used for fluent-query inference; implementations do not expose a meaningful runtime value. */
  readonly expressionType: Output | undefined;

  /** Aliases this expression for SELECT output and result mapping. */
  as<Alias extends string>(
    alias: Alias,
  ): AliasedSelectFunctionBuilder<Output, Alias>;

  /** Returns the immutable operation node represented by this expression. */
  toOperationNode(): ConvertCurrencyFunctionNode;
}

/** Builder for Salesforce FORMAT() expressions. */
export interface FormatFunctionBuilder<Output> {
  /** Type-only output marker used for fluent-query inference; implementations do not expose a meaningful runtime value. */
  readonly expressionType: Output | undefined;

  /** Aliases this expression for SELECT output and result mapping. */
  as<Alias extends string>(
    alias: Alias,
  ): AliasedSelectFunctionBuilder<Output, Alias>;

  /** Returns the immutable operation node represented by this expression. */
  toOperationNode(): FormatFunctionNode;
}

/** Builder for FORMAT() applied to an aggregate expression. */
export interface AggregateFormatFunctionBuilder<Output> {
  /** Type-only output marker used for fluent-query inference; implementations do not expose a meaningful runtime value. */
  readonly expressionType: Output | undefined;

  /** Aliases this expression for SELECT output and result mapping. */
  as<Alias extends string>(
    alias: Alias,
  ): AliasedAggregateFunctionBuilder<Output, Alias>;

  /** Returns the immutable operation node represented by this expression. */
  toOperationNode(): FormatFunctionNode;
}

/** Aliased scalar SELECT-function expression. */
export interface AliasedSelectFunctionBuilder<Output, Alias extends string> {
  /** Type-only output marker used for fluent-query inference; implementations do not expose a meaningful runtime value. */
  readonly expressionType: Output | undefined;
  /** Selection alias used as the mapped result property name. */
  readonly alias: Alias | undefined;
  /** Type-only marker used to preserve this expression capability through TypeScript inference. */
  readonly [selectFunctionSelectionType]: true;

  /** Returns the immutable operation node represented by this expression. */
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

class ConvertTimezoneFunctionBuilderImpl<Reference extends string>
  implements ConvertTimezoneFunctionBuilder<Reference>
{
  declare readonly [convertTimezoneReferenceType]: Reference;

  readonly #node: ConvertTimezoneFunctionNode;

  constructor(node: ConvertTimezoneFunctionNode) {
    this.#node = node;
  }

  toOperationNode(): ConvertTimezoneFunctionNode {
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

class AggregateFormatFunctionBuilderImpl<Output>
  implements AggregateFormatFunctionBuilder<Output>
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
  ): AliasedAggregateFunctionBuilder<Output, Alias> {
    return new AliasedFormattedAggregateFunctionBuilderImpl<Output, Alias>(
      this.#node,
      parseSelectionAlias(alias) as Alias,
    );
  }

  toOperationNode(): FormatFunctionNode {
    return this.#node;
  }
}

class AliasedFormattedAggregateFunctionBuilderImpl<Output, Alias extends string>
  implements AliasedAggregateFunctionBuilder<Output, Alias>
{
  declare readonly [aggregateFunctionSelectionType]: true;

  readonly #node: AliasNode;
  readonly #alias: Alias;

  constructor(node: FormatFunctionNode, alias: Alias) {
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

type DateFunctionInput = ConvertTimezoneFunctionBuilder<string> | string;

type DateFunctionInputReference<Input extends DateFunctionInput> =
  Input extends ConvertTimezoneFunctionBuilder<infer Reference>
    ? Reference
    : Input extends string
      ? Input
      : never;

type DateFunctionInputIdentity<Input extends DateFunctionInput> =
  Input extends ConvertTimezoneFunctionBuilder<infer Reference>
    ? ConvertTimezoneIdentity<Reference>
    : Input extends string
      ? Input
      : never;

type DateFunctionArgument<
  DB,
  TB extends keyof DB,
  Input extends DateFunctionInput,
  SalesforceType extends TemporalSalesforceType = TemporalSalesforceType,
> = Input extends string
  ? Input & DateGroupableFieldReference<DB, TB, Input, SalesforceType>
  : Input;

type NumericDateFunctionBuilder<
  DB,
  TB extends keyof DB,
  Function extends DateFunction,
  Input extends DateFunctionInput,
> = DateFunctionBuilder<
  DateFunctionOutput<DB, TB, DateFunctionInputReference<Input>, number>,
  DateFunctionComparisonValue<
    DB,
    TB,
    DateFunctionInputReference<Input>,
    number
  >,
  NumericAggregateOperator,
  DateFunctionIdentity<Function, DateFunctionInputIdentity<Input>>
>;

type DayOnlyFunctionBuilder<
  DB,
  TB extends keyof DB,
  Input extends DateFunctionInput,
> = DateFunctionBuilder<
  DateFunctionOutput<DB, TB, DateFunctionInputReference<Input>, string>,
  DateFunctionComparisonValue<
    DB,
    TB,
    DateFunctionInputReference<Input>,
    SoqlDateLiteral
  >,
  NumericAggregateOperator,
  DateFunctionIdentity<"dayOnly", DateFunctionInputIdentity<Input>>
>;

/** Aggregate and date-function helpers exposed to expression callbacks. */
export interface AggregateFunctionModule<
  DB,
  TB extends keyof DB,
  GroupingFields extends string = never,
> {
  /** Builds `CALENDAR_MONTH(...)` for a date or datetime field. */
  calendarMonth<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "calendarMonth", Input>;

  /** Builds `CALENDAR_QUARTER(...)` for a date or datetime field. */
  calendarQuarter<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "calendarQuarter", Input>;

  /** Builds `CALENDAR_YEAR(...)` for a date or datetime field. */
  calendarYear<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "calendarYear", Input>;

  /** Builds `DAY_IN_MONTH(...)` for a date or datetime field. */
  dayInMonth<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "dayInMonth", Input>;

  /** Builds `DAY_IN_WEEK(...)` for a date or datetime field. */
  dayInWeek<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "dayInWeek", Input>;

  /** Builds `DAY_IN_YEAR(...)` for a date or datetime field. */
  dayInYear<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "dayInYear", Input>;

  /** Builds `DAY_ONLY(...)` for a datetime field. */
  dayOnly<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input, "datetime">,
  ): DayOnlyFunctionBuilder<DB, TB, Input>;

  /** Builds `FISCAL_MONTH(...)` for a date or datetime field. */
  fiscalMonth<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "fiscalMonth", Input>;

  /** Builds `FISCAL_QUARTER(...)` for a date or datetime field. */
  fiscalQuarter<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "fiscalQuarter", Input>;

  /** Builds `FISCAL_YEAR(...)` for a date or datetime field. */
  fiscalYear<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "fiscalYear", Input>;

  /** Builds `HOUR_IN_DAY(...)` for a datetime field. */
  hourInDay<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input, "datetime">,
  ): NumericDateFunctionBuilder<DB, TB, "hourInDay", Input>;

  /** Builds `WEEK_IN_MONTH(...)` for a date or datetime field. */
  weekInMonth<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "weekInMonth", Input>;

  /** Builds `WEEK_IN_YEAR(...)` for a date or datetime field. */
  weekInYear<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "weekInYear", Input>;

  /** Builds a Salesforce `convertTimezone(...)` expression. */
  convertTimezone<Reference extends string>(
    field: Reference &
      DateGroupableFieldReference<DB, TB, Reference, "datetime">,
  ): ConvertTimezoneFunctionBuilder<Reference>;

  /** Builds a Salesforce `GROUPING(...)` aggregate expression. */
  grouping<Reference extends string>(
    field: Reference &
      GroupingFieldReference<DB, TB, GroupingFields, Reference>,
  ): GroupingFunctionBuilder;

  /** Builds a Salesforce `COUNT` aggregate expression. */
  count(): CountAllFunctionBuilder;

  /** Builds a Salesforce `COUNT` aggregate expression. */
  count<Reference extends string>(
    field: Reference & AggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<number, number, NumericAggregateOperator>;

  /** Builds a Salesforce `COUNT_DISTINCT(...)` expression. */
  countDistinct<Reference extends string>(
    field: Reference & AggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<number, number, NumericAggregateOperator>;

  /** Builds a Salesforce `AVG(...)` aggregate expression. */
  avg<Reference extends string>(
    field: Reference & NumericAggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<
    number | null,
    number | null,
    NumericAggregateOperator
  >;

  /** Builds a Salesforce `MAX(...)` aggregate expression. */
  max<Reference extends string>(
    field: Reference & AggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<
    AggregateFieldValue<DB, TB, Reference>,
    AggregateFieldComparisonValue<DB, TB, Reference>,
    AggregateFieldComparisonOperator<DB, TB, Reference>
  >;

  /** Builds a Salesforce `MIN(...)` aggregate expression. */
  min<Reference extends string>(
    field: Reference & AggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<
    AggregateFieldValue<DB, TB, Reference>,
    AggregateFieldComparisonValue<DB, TB, Reference>,
    AggregateFieldComparisonOperator<DB, TB, Reference>
  >;

  /** Builds a Salesforce `SUM(...)` aggregate expression. */
  sum<Reference extends string>(
    field: Reference & NumericAggregatableFieldReference<DB, TB, Reference>,
  ): AggregateFunctionBuilder<
    number | null,
    number | null,
    NumericAggregateOperator
  >;
}

/**
 * Scalar, aggregate, date, and geolocation helpers exposed to SELECT
 * callbacks.
 */
export interface SelectFunctionModule<
  DB,
  TB extends keyof DB,
  GroupingFields extends string = never,
> extends AggregateFunctionModule<DB, TB, GroupingFields>,
    GeolocationFunctionModule<DB, TB> {
  /** Builds a Salesforce `convertCurrency(...)` expression. */
  convertCurrency<Reference extends string>(
    field: Reference & CurrencyFieldReference<DB, TB, Reference>,
  ): ConvertCurrencyFunctionBuilder<ConvertCurrencyOutput<DB, TB, Reference>>;

  /** Builds a Salesforce `FORMAT(...)` expression. */
  format<Reference extends string>(
    field: Reference & FormattableFieldReference<DB, TB, Reference>,
  ): FormatFunctionBuilder<FormatOutput<DB, TB, Reference>>;

  /** Builds a Salesforce `FORMAT(...)` expression. */
  format<Output>(
    expression: ConvertCurrencyFunctionBuilder<Output>,
  ): FormatFunctionBuilder<NestedFormatOutput<Output>>;

  /** Builds a Salesforce `FORMAT(...)` expression. */
  format<Output, ComparisonValue, Operator extends ComparisonOperator>(
    expression: FormattableAggregateFunctionBuilder<
      Output,
      ComparisonValue,
      Operator
    >,
  ): AggregateFormatFunctionBuilder<NestedFormatOutput<Output>>;

  /** Builds a Salesforce `toLabel(...)` expression. */
  toLabel<Reference extends string>(
    field: Reference & TranslatableFieldReference<DB, TB, Reference>,
  ): ToLabelFunctionBuilder<ToLabelOutput<DB, TB, Reference>>;
}

class AggregateFunctionModuleImpl<
  DB,
  TB extends keyof DB,
  GroupingFields extends string,
> extends GeolocationFunctionModuleImpl<DB, TB> {
  readonly #groupingFields: readonly string[];

  constructor(groupingFields: readonly string[]) {
    super();
    this.#groupingFields = freeze([...groupingFields]);
  }

  #dateFunctionArgument(input: DateFunctionInput): DateFunctionArgumentNode {
    if (typeof input === "string") {
      return ReferenceNode.create(input);
    }

    const node = input.toOperationNode();

    if (node.kind !== "ConvertTimezoneFunctionNode") {
      throw new TypeError(
        "SOQL date functions require a field reference or an unaliased convertTimezone() expression.",
      );
    }

    return node;
  }

  #numericDateFunction<
    Function extends DateFunction,
    Input extends DateFunctionInput,
  >(
    dateFunction: Function,
    input: Input,
  ): NumericDateFunctionBuilder<DB, TB, Function, Input> {
    return new DateFunctionBuilderImpl<
      DateFunctionOutput<DB, TB, DateFunctionInputReference<Input>, number>,
      DateFunctionComparisonValue<
        DB,
        TB,
        DateFunctionInputReference<Input>,
        number
      >,
      NumericAggregateOperator,
      DateFunctionIdentity<Function, DateFunctionInputIdentity<Input>>
    >(DateFunctionNode.create(dateFunction, this.#dateFunctionArgument(input)));
  }

  #dayOnly<Input extends DateFunctionInput>(
    input: Input,
  ): DayOnlyFunctionBuilder<DB, TB, Input> {
    return new DateFunctionBuilderImpl<
      DateFunctionOutput<DB, TB, DateFunctionInputReference<Input>, string>,
      DateFunctionComparisonValue<
        DB,
        TB,
        DateFunctionInputReference<Input>,
        SoqlDateLiteral
      >,
      NumericAggregateOperator,
      DateFunctionIdentity<"dayOnly", DateFunctionInputIdentity<Input>>
    >(DateFunctionNode.create("dayOnly", this.#dateFunctionArgument(input)));
  }

  calendarMonth<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "calendarMonth", Input> {
    return this.#numericDateFunction("calendarMonth", field as Input);
  }

  calendarQuarter<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "calendarQuarter", Input> {
    return this.#numericDateFunction("calendarQuarter", field as Input);
  }

  calendarYear<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "calendarYear", Input> {
    return this.#numericDateFunction("calendarYear", field as Input);
  }

  dayInMonth<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "dayInMonth", Input> {
    return this.#numericDateFunction("dayInMonth", field as Input);
  }

  dayInWeek<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "dayInWeek", Input> {
    return this.#numericDateFunction("dayInWeek", field as Input);
  }

  dayInYear<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "dayInYear", Input> {
    return this.#numericDateFunction("dayInYear", field as Input);
  }

  dayOnly<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input, "datetime">,
  ): DayOnlyFunctionBuilder<DB, TB, Input> {
    return this.#dayOnly(field as Input);
  }

  fiscalMonth<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "fiscalMonth", Input> {
    return this.#numericDateFunction("fiscalMonth", field as Input);
  }

  fiscalQuarter<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "fiscalQuarter", Input> {
    return this.#numericDateFunction("fiscalQuarter", field as Input);
  }

  fiscalYear<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "fiscalYear", Input> {
    return this.#numericDateFunction("fiscalYear", field as Input);
  }

  hourInDay<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input, "datetime">,
  ): NumericDateFunctionBuilder<DB, TB, "hourInDay", Input> {
    return this.#numericDateFunction("hourInDay", field as Input);
  }

  weekInMonth<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "weekInMonth", Input> {
    return this.#numericDateFunction("weekInMonth", field as Input);
  }

  weekInYear<Input extends DateFunctionInput>(
    field: Input & DateFunctionArgument<DB, TB, Input>,
  ): NumericDateFunctionBuilder<DB, TB, "weekInYear", Input> {
    return this.#numericDateFunction("weekInYear", field as Input);
  }

  convertTimezone<Reference extends string>(
    field: Reference &
      DateGroupableFieldReference<DB, TB, Reference, "datetime">,
  ): ConvertTimezoneFunctionBuilder<Reference> {
    if (typeof field !== "string") {
      throw new TypeError(
        "SOQL convertTimezone() requires a datetime field reference.",
      );
    }

    return new ConvertTimezoneFunctionBuilderImpl<Reference>(
      ConvertTimezoneFunctionNode.create(ReferenceNode.create(field)),
    );
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
  format<Output, ComparisonValue, Operator extends ComparisonOperator>(
    expression: FormattableAggregateFunctionBuilder<
      Output,
      ComparisonValue,
      Operator
    >,
  ): AggregateFormatFunctionBuilder<NestedFormatOutput<Output>>;
  format(
    fieldOrExpression:
      | string
      | ConvertCurrencyFunctionBuilder<unknown>
      | AggregateFunctionBuilder<unknown, unknown, ComparisonOperator>,
  ):
    | AggregateFormatFunctionBuilder<string | null>
    | FormatFunctionBuilder<string | null> {
    const expression =
      typeof fieldOrExpression === "string"
        ? ReferenceNode.create(fieldOrExpression)
        : fieldOrExpression.toOperationNode();

    if (
      expression.kind === "AggregateFunctionNode" &&
      expression.function !== "grouping" &&
      expression.reference !== undefined
    ) {
      return new AggregateFormatFunctionBuilderImpl<string | null>(
        FormatFunctionNode.create(expression),
      );
    }

    if (
      expression.kind !== "ReferenceNode" &&
      expression.kind !== "ConvertCurrencyFunctionNode"
    ) {
      throw new TypeError(
        "SOQL FORMAT() only supports field references, unaliased convertCurrency() expressions, or unaliased aggregate functions with field arguments.",
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

/** Expression helper passed to typed SELECT and grouping callbacks. */
export interface SelectExpressionBuilder<
  DB,
  TB extends keyof DB,
  GroupingFields extends string = never,
> {
  /** Function helpers available in this expression context. */
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
