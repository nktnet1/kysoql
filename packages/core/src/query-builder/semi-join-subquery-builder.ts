import {
  createExpressionBuilder,
  type WhereExpressionFactory,
} from "#/expression/expression-builder";
import type { ComparisonOperator } from "#/operation-node/operator-node";
import { QueryNode } from "#/operation-node/query-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { SemiJoinSubqueryNode } from "#/operation-node/semi-join-subquery-node";
import { SObjectNode } from "#/operation-node/sobject-node";
import {
  parseValueBinaryOperation,
  type ComparisonOperatorExpression,
  type FilterableFieldName,
  type OperandValueExpression,
} from "#/parser/binary-operation-parser";
import type {
  FieldDefinition,
  FieldName,
} from "#/parser/reference-parser";
import { freeze } from "#/util/object-utils";

declare const semiJoinSubqueryExpressionType: unique symbol;

const UNSUPPORTED_SEMI_JOIN_SUBQUERY_OBJECTS = new Set([
  "ActivityHistory",
  "Attachment",
  "Event",
  "Note",
  "OpenActivity",
  "Task",
]);
const SEMI_JOIN_SUBQUERY_OBJECT_ERROR =
  "This Salesforce object is not supported in semi-join or anti-join subqueries.";

function assertSupportedSemiJoinSubqueryObject(from: string): void {
  if (UNSUPPORTED_SEMI_JOIN_SUBQUERY_OBJECTS.has(from) || from.endsWith("Tag")) {
    throw new TypeError(SEMI_JOIN_SUBQUERY_OBJECT_ERROR);
  }
}

type SemiJoinObjectNamesForField<
  DB,
  TB extends keyof DB,
  Field extends FieldName<DB, TB>,
> = FieldDefinition<DB, TB, Field> extends {
  readonly salesforceType: "id";
}
  ? Extract<TB, string>
  : FieldDefinition<DB, TB, Field> extends {
        readonly salesforceType: "reference";
        readonly referenceTo: infer ReferenceTo extends string;
      }
    ? ReferenceTo
    : never;

export type SemiJoinOperandFieldName<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends FieldName<DB, TB>
  ? FieldDefinition<DB, TB, Reference> extends {
      readonly filterable: true;
      readonly salesforceType: "id" | "reference";
    }
    ? Reference
    : never
  : never;

type SemiJoinSelectionFieldName<
  DB,
  OuterTB extends keyof DB,
  OuterReference extends string,
  TB extends keyof DB,
  Reference extends string,
> = OuterReference extends FieldName<DB, OuterTB>
  ? Reference extends FieldName<DB, TB>
    ? Extract<
        SemiJoinObjectNamesForField<DB, OuterTB, OuterReference>,
        SemiJoinObjectNamesForField<DB, TB, Reference>
      > extends never
      ? never
      : Reference
    : never
  : never;

type UnsupportedSemiJoinSubqueryObjectName =
  | "ActivityHistory"
  | "Attachment"
  | "Event"
  | "Note"
  | "OpenActivity"
  | "Task";

type SelectableSemiJoinSubqueryObjectName<
  DB,
  OuterTB extends keyof DB,
  TB extends string,
> = TB extends Extract<OuterTB, string>
  ? never
  : TB extends UnsupportedSemiJoinSubqueryObjectName | `${string}Tag`
    ? never
    : TB extends keyof DB & string
      ? TB
      : never;

export interface SemiJoinSubqueryExpression<
  DB,
  OuterTB extends keyof DB,
  OuterReference extends string,
> {
  readonly [semiJoinSubqueryExpressionType]: {
    readonly db: DB;
    readonly outerTable: OuterTB;
    readonly outerReference: OuterReference;
  };

  toOperationNode(): SemiJoinSubqueryNode;
}

interface SemiJoinWhereBuilder<
  DB,
  OuterTB extends keyof DB,
  OuterReference extends string,
  TB extends keyof DB,
  Result,
> {
  where(
    expression: WhereExpressionFactory<DB, TB, false>,
  ): Result;

  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>, false>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): Result;
}

export interface SemiJoinSubqueryBuilder<
  DB,
  OuterTB extends keyof DB,
  OuterReference extends string,
  TB extends keyof DB,
> extends SemiJoinWhereBuilder<
    DB,
    OuterTB,
    OuterReference,
    TB,
    SemiJoinSubqueryBuilder<DB, OuterTB, OuterReference, TB>
  > {
  select<SE extends string>(
    selection: SE &
      SemiJoinSelectionFieldName<DB, OuterTB, OuterReference, TB, SE>,
  ): SelectedSemiJoinSubqueryBuilder<DB, OuterTB, OuterReference, TB>;
}

export interface SelectedSemiJoinSubqueryBuilder<
  DB,
  OuterTB extends keyof DB,
  OuterReference extends string,
  TB extends keyof DB,
> extends SemiJoinSubqueryExpression<DB, OuterTB, OuterReference>,
    SemiJoinWhereBuilder<
      DB,
      OuterTB,
      OuterReference,
      TB,
      SelectedSemiJoinSubqueryBuilder<DB, OuterTB, OuterReference, TB>
    > {}

export interface SemiJoinQueryCreator<
  DB,
  OuterTB extends keyof DB,
  OuterReference extends string,
> {
  selectFrom<TB extends keyof DB & string>(
    from: TB & SelectableSemiJoinSubqueryObjectName<DB, OuterTB, TB>,
  ): SemiJoinSubqueryBuilder<DB, OuterTB, OuterReference, TB>;
}

export type SemiJoinSubqueryFactory<
  DB,
  OuterTB extends keyof DB,
  OuterReference extends string,
> = (
  query: SemiJoinQueryCreator<DB, OuterTB, OuterReference>,
) => SemiJoinSubqueryExpression<DB, OuterTB, OuterReference>;

interface SemiJoinSubqueryBuilderProps {
  readonly queryNode: SemiJoinSubqueryNode;
}

class SemiJoinSubqueryBuilderImpl<
  DB,
  OuterTB extends keyof DB,
  OuterReference extends string,
  TB extends keyof DB,
> {
  declare readonly [semiJoinSubqueryExpressionType]: {
    readonly db: DB;
    readonly outerTable: OuterTB;
    readonly outerReference: OuterReference;
  };

  readonly #props: SemiJoinSubqueryBuilderProps;

  constructor(props: SemiJoinSubqueryBuilderProps) {
    this.#props = freeze(props);
  }

  select<SE extends string>(
    selection: SE &
      SemiJoinSelectionFieldName<DB, OuterTB, OuterReference, TB, SE>,
  ): SelectedSemiJoinSubqueryBuilder<DB, OuterTB, OuterReference, TB> {
    return new SemiJoinSubqueryBuilderImpl<DB, OuterTB, OuterReference, TB>({
      ...this.#props,
      queryNode: SemiJoinSubqueryNode.cloneWithSelection(
        this.#props.queryNode,
        ReferenceNode.create(selection),
      ),
    }) as SelectedSemiJoinSubqueryBuilder<DB, OuterTB, OuterReference, TB>;
  }

  where(
    lhsOrExpression: string | WhereExpressionFactory<DB, TB, false>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ):
    | SemiJoinSubqueryBuilder<DB, OuterTB, OuterReference, TB>
    | SelectedSemiJoinSubqueryBuilder<DB, OuterTB, OuterReference, TB> {
    const operation =
      typeof lhsOrExpression === "function"
        ? lhsOrExpression(
            createExpressionBuilder<DB, TB, false>({
              allowSemiJoin: false,
            }),
          ).toOperationNode()
        : parseValueBinaryOperation(
            lhsOrExpression,
            op as ComparisonOperator,
            rhs,
          );

    return new SemiJoinSubqueryBuilderImpl<DB, OuterTB, OuterReference, TB>({
      ...this.#props,
      queryNode: QueryNode.cloneWithWhere(this.#props.queryNode, operation),
    }) as
      | SemiJoinSubqueryBuilder<DB, OuterTB, OuterReference, TB>
      | SelectedSemiJoinSubqueryBuilder<DB, OuterTB, OuterReference, TB>;
  }

  toOperationNode(): SemiJoinSubqueryNode {
    return this.#props.queryNode;
  }
}

class SemiJoinQueryCreatorImpl<
  DB,
  OuterTB extends keyof DB,
  OuterReference extends string,
> implements SemiJoinQueryCreator<DB, OuterTB, OuterReference>
{
  selectFrom<TB extends keyof DB & string>(
    from: TB & SelectableSemiJoinSubqueryObjectName<DB, OuterTB, TB>,
  ): SemiJoinSubqueryBuilder<DB, OuterTB, OuterReference, TB> {
    assertSupportedSemiJoinSubqueryObject(from);

    return new SemiJoinSubqueryBuilderImpl<DB, OuterTB, OuterReference, TB>({
      queryNode: SemiJoinSubqueryNode.createFrom(SObjectNode.create(from)),
    }) as SemiJoinSubqueryBuilder<DB, OuterTB, OuterReference, TB>;
  }
}

export function createSemiJoinQueryCreator<
  DB,
  OuterTB extends keyof DB,
  OuterReference extends string,
>(): SemiJoinQueryCreator<DB, OuterTB, OuterReference> {
  return new SemiJoinQueryCreatorImpl<DB, OuterTB, OuterReference>();
}
