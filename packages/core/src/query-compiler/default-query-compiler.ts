import * as v from "valibot";

import type { AggregateFunctionNode } from "#/operation-node/aggregate-function-node";
import type { AliasNode } from "#/operation-node/alias-node";
import type { AndNode } from "#/operation-node/and-node";
import type { ApexBindNode } from "#/operation-node/apex-bind-node";
import type {
  ApexAdditionNode,
  ApexBindExpressionNode,
  ApexExpressionOperandNode,
  ApexQueryResultNode,
  ApexSubstringNode,
} from "#/operation-node/apex-expression-node";
import type { ApexLiteralNode } from "#/operation-node/apex-literal-node";
import type { BinaryOperationNode } from "#/operation-node/binary-operation-node";
import type { ConvertCurrencyFunctionNode } from "#/operation-node/convert-currency-function-node";
import type { ConvertTimezoneFunctionNode } from "#/operation-node/convert-timezone-function-node";
import type { DateFunctionNode } from "#/operation-node/date-function-node";
import type { DistanceFunctionNode } from "#/operation-node/distance-function-node";
import type { FieldsFunctionNode } from "#/operation-node/fields-function-node";
import type { ForViewReferenceNode } from "#/operation-node/for-view-reference-node";
import type { FormatFunctionNode } from "#/operation-node/format-function-node";
import type { GeolocationFunctionNode } from "#/operation-node/geolocation-function-node";
import type { GroupByNode } from "#/operation-node/group-by-node";
import type { HavingNode } from "#/operation-node/having-node";
import type { KnowledgeUpdateNode } from "#/operation-node/knowledge-update-node";
import type { LimitNode } from "#/operation-node/limit-node";
import type { NotNode } from "#/operation-node/not-node";
import type { OffsetNode } from "#/operation-node/offset-node";
import type { OperationNode } from "#/operation-node/operation-node";
import type { OperatorNode } from "#/operation-node/operator-node";
import type { OrNode } from "#/operation-node/or-node";
import type { OrderByItemNode } from "#/operation-node/order-by-item-node";
import type { OrderByNode } from "#/operation-node/order-by-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import type { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";
import type { SelectQueryNode } from "#/operation-node/select-query-node";
import type { SelectionNode } from "#/operation-node/selection-node";
import type { SemiJoinSubqueryNode } from "#/operation-node/semi-join-subquery-node";
import type { ToLabelFunctionNode } from "#/operation-node/to-label-function-node";
import type { TypeOfNode } from "#/operation-node/type-of-node";
import type { UserProfileFeedWithNode } from "#/operation-node/user-profile-feed-with-node";
import type { UsingScopeNode } from "#/operation-node/using-scope-node";
import type { ValueListNode } from "#/operation-node/value-list-node";
import type { ValueNode } from "#/operation-node/value-node";
import type { WhereNode } from "#/operation-node/where-node";
import type {
  DataCategorySelectionNode,
  WithDataCategoryNode,
} from "#/operation-node/with-data-category-node";
import { validateAllRowsQuery } from "#/parser/all-rows-parser";
import { validateApexAccessModeQuery } from "#/parser/apex-access-mode-parser";
import { validateApexBindQuery } from "#/parser/apex-bind-parser";
import { validateDataCategoryQuery } from "#/parser/data-category-parser";
import { validateFieldsSelections } from "#/parser/fields-selection-parser";
import { validateForUpdateQuery } from "#/parser/for-update-parser";
import { validateKnowledgeUpdateQuery } from "#/parser/knowledge-update-parser";
import { validateObjectQueryLimits } from "#/parser/object-query-limit-parser";
import { validateRelationshipQueryLimits } from "#/parser/relationship-query-limit-parser";
import { validateTypeOfSelections } from "#/parser/type-of-parser";
import { validateUserProfileFeedQuery } from "#/parser/user-profile-feed-parser";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import { isSoqlCurrencyLiteral } from "#/soql-currency-literal";
import { isSoqlRelativeDateLiteral } from "#/soql-relative-date-literal";
import { isSoqlTemporalLiteral } from "#/soql-temporal-literal";
import { freeze } from "#/util/object-utils";

const NUMERIC_LITERAL_ERROR = "SOQL numeric literals must be finite numbers.";
const numericLiteralSchema = v.pipe(
  v.number(NUMERIC_LITERAL_ERROR),
  v.finite(NUMERIC_LITERAL_ERROR),
);

export class DefaultQueryCompiler implements QueryCompiler {
  compileQuery<O = unknown>(query: SelectQueryNode): CompiledQuery<O> {
    return freeze({
      query,
      soql: this.#compileSelectQuery(query),
    });
  }

  #compileSelectQuery(query: SelectQueryNode): string {
    if (!query.selections?.length) {
      throw new Error("Cannot compile a SELECT query without selections.");
    }

    validateFieldsSelections(query.selections, query.limit);
    validateAllRowsQuery(query);
    validateApexAccessModeQuery(query);
    validateApexBindQuery(query);
    validateForUpdateQuery(query);
    validateTypeOfSelections(query);
    validateKnowledgeUpdateQuery(query);
    validateUserProfileFeedQuery(query);
    validateRelationshipQueryLimits(query);
    validateObjectQueryLimits(query);

    let soql = `SELECT ${query.selections.map((selection) => this.#compileSelection(selection)).join(", ")} FROM ${query.from.name}`;

    if (query.usingScope) {
      soql += ` USING SCOPE ${this.#compileUsingScope(query.usingScope)}`;
    }

    if (query.where) {
      soql += ` WHERE ${this.#compileWhere(query.where)}`;
    }

    if (query.userProfileFeedWith) {
      soql += ` WITH ${this.#compileUserProfileFeedWith(query.userProfileFeedWith)}`;
    }

    if (query.withDataCategory) {
      validateDataCategoryQuery(query);
      soql += ` WITH DATA CATEGORY ${this.#compileWithDataCategory(query.withDataCategory)}`;
    }

    if (query.apexAccessMode) {
      soql += ` WITH ${query.apexAccessMode.mode.toUpperCase()}_MODE`;
    }

    if (query.groupBy) {
      soql += ` GROUP BY ${this.#compileGroupBy(query.groupBy)}`;
    }

    if (query.having) {
      soql += ` HAVING ${this.#compileHaving(query.having)}`;
    }

    if (query.orderBy) {
      soql += ` ORDER BY ${this.#compileOrderBy(query.orderBy)}`;
    }

    if (query.limit) {
      soql += ` LIMIT ${this.#compileLimit(query.limit)}`;
    }

    if (query.offset) {
      soql += ` OFFSET ${this.#compileOffset(query.offset)}`;
    }

    if (query.forViewReference) {
      soql += ` FOR ${this.#compileForViewReference(query.forViewReference)}`;
    }

    if (query.knowledgeUpdate) {
      soql += ` UPDATE ${this.#compileKnowledgeUpdate(query.knowledgeUpdate)}`;
    }

    if (query.allRows) {
      soql += " ALL ROWS";
    }

    if (query.forUpdate) {
      soql += " FOR UPDATE";
    }

    return soql;
  }

  #compileSelection(selection: SelectionNode): string {
    switch (selection.selection.kind) {
      case "AggregateFunctionNode":
        return this.#compileAggregateFunction(
          selection.selection as AggregateFunctionNode,
        );
      case "AliasNode":
        return this.#compileAlias(selection.selection as AliasNode);
      case "DateFunctionNode":
        return this.#compileDateFunction(
          selection.selection as DateFunctionNode,
        );
      case "FieldsFunctionNode":
        return this.#compileFieldsFunction(
          selection.selection as FieldsFunctionNode,
        );
      case "ReferenceNode":
        return this.#compileReference(selection.selection as ReferenceNode);
      case "RelationshipSubqueryNode":
        return `(${this.#compileRelationshipSubquery(
          selection.selection as RelationshipSubqueryNode,
        )})`;
      case "TypeOfNode":
        return this.#compileTypeOf(selection.selection as TypeOfNode);
      default:
        throw new Error("Unsupported selection node.");
    }
  }

  #compileTypeOf(node: TypeOfNode): string {
    const whens = node.whens
      .map(
        (when) =>
          `WHEN ${when.object} THEN ${when.selections
            .map((selection) => this.#compileReference(selection))
            .join(", ")}`,
      )
      .join(" ");
    const elseClause = node.elseSelections
      ? ` ELSE ${node.elseSelections
          .map((selection) => this.#compileReference(selection))
          .join(", ")}`
      : "";

    return `TYPEOF ${this.#compileReference(node.reference)} ${whens}${elseClause} END`;
  }

  #compileRelationshipSubquery(query: RelationshipSubqueryNode): string {
    if (!query.selections?.length) {
      throw new Error(
        "Cannot compile a relationship subquery without selections.",
      );
    }

    validateFieldsSelections(query.selections, query.limit);

    let soql = `SELECT ${query.selections
      .map((selection) => this.#compileSelection(selection))
      .join(", ")} FROM ${this.#compileReference(query.relationship)}`;

    if (query.where) {
      soql += ` WHERE ${this.#compileWhere(query.where)}`;
    }

    if (query.orderBy) {
      soql += ` ORDER BY ${this.#compileOrderBy(query.orderBy)}`;
    }

    if (query.limit) {
      soql += ` LIMIT ${this.#compileLimit(query.limit)}`;
    }

    return soql;
  }

  #compileWhere(where: WhereNode): string {
    return this.#compileOperation(where.where);
  }

  #compileWithDataCategory(node: WithDataCategoryNode): string {
    return node.selections
      .map((selection) => this.#compileDataCategorySelection(selection))
      .join(" AND ");
  }

  #compileDataCategorySelection(node: DataCategorySelectionNode): string {
    const selector = node.selector.toUpperCase();
    const categories =
      node.categories.length === 1
        ? node.categories[0]
        : `(${node.categories.join(", ")})`;

    return `${node.group} ${selector} ${categories}`;
  }

  #compileLimit(limit: LimitNode<number | ApexBindExpressionNode>): string {
    return typeof limit.limit === "number"
      ? String(limit.limit)
      : this.#compileApexBind(limit.limit);
  }

  #compileFieldsFunction(node: FieldsFunctionNode): string {
    return `FIELDS(${node.selector.toUpperCase()})`;
  }

  #compileOffset(offset: OffsetNode<number | ApexBindExpressionNode>): string {
    return typeof offset.offset === "number"
      ? String(offset.offset)
      : this.#compileApexBind(offset.offset);
  }

  #compileUsingScope(usingScope: UsingScopeNode): string {
    return usingScope.scope;
  }

  #compileUserProfileFeedWith(node: UserProfileFeedWithNode): string {
    return `UserId = ${this.#compileValue(node.userId)}`;
  }

  #compileForViewReference(node: ForViewReferenceNode): string {
    return node.mode === "view" ? "VIEW" : "REFERENCE";
  }

  #compileKnowledgeUpdate(node: KnowledgeUpdateNode): string {
    return node.modes
      .map((mode) => (mode === "tracking" ? "TRACKING" : "VIEWSTAT"))
      .join(", ");
  }

  #compileGroupBy(groupBy: GroupByNode): string {
    const fields = groupBy.items
      .map((item) => this.#compileOperation(item))
      .join(", ");

    return groupBy.mode ? `${groupBy.mode.toUpperCase()}(${fields})` : fields;
  }

  #compileHaving(having: HavingNode): string {
    return this.#compileOperation(having.having);
  }

  #compileOrderBy(orderBy: OrderByNode): string {
    return orderBy.items
      .map((item) => this.#compileOrderByItem(item))
      .join(", ");
  }

  #compileOrderByItem(item: OrderByItemNode): string {
    let orderBy = this.#compileOperation(item.orderBy);

    if (item.direction) {
      orderBy += ` ${item.direction === "asc" ? "ASC" : "DESC"}`;
    }

    if (item.nulls) {
      orderBy += ` NULLS ${item.nulls === "first" ? "FIRST" : "LAST"}`;
    }

    return orderBy;
  }

  #compileOperation(node: OperationNode): string {
    switch (node.kind) {
      case "AggregateFunctionNode":
        return this.#compileAggregateFunction(node as AggregateFunctionNode);
      case "AliasNode":
        return this.#compileAlias(node as AliasNode);
      case "AndNode":
        return this.#compileAnd(node as AndNode);
      case "ApexAdditionNode":
      case "ApexBindNode":
      case "ApexQueryResultNode":
      case "ApexSubstringNode":
        return this.#compileApexBind(node as ApexBindExpressionNode);
      case "BinaryOperationNode":
        return this.#compileBinaryOperation(node as BinaryOperationNode);
      case "ConvertCurrencyFunctionNode":
        return this.#compileConvertCurrencyFunction(
          node as ConvertCurrencyFunctionNode,
        );
      case "DateFunctionNode":
        return this.#compileDateFunction(node as DateFunctionNode);
      case "DistanceFunctionNode":
        return this.#compileDistanceFunction(node as DistanceFunctionNode);
      case "FormatFunctionNode":
        return this.#compileFormatFunction(node as FormatFunctionNode);
      case "GeolocationFunctionNode":
        return this.#compileGeolocationFunction(
          node as GeolocationFunctionNode,
        );
      case "NotNode":
        return this.#compileNot(node as NotNode);
      case "OrNode":
        return this.#compileOr(node as OrNode);
      case "ReferenceNode":
        return this.#compileReference(node as ReferenceNode);
      case "SemiJoinSubqueryNode":
        return `(${this.#compileSemiJoinSubquery(node as SemiJoinSubqueryNode)})`;
      case "ToLabelFunctionNode":
        return this.#compileToLabelFunction(node as ToLabelFunctionNode);
      case "OperatorNode":
        return this.#compileOperator(node as OperatorNode);
      case "ValueListNode":
        return this.#compileValueList(node as ValueListNode);
      case "ValueNode":
        return this.#compileValue(node as ValueNode);
      default:
        throw new Error(`Unsupported operation node: ${node.kind}`);
    }
  }

  #compileApexBind(node: ApexBindExpressionNode): string {
    return `:${this.#compileApexExpression(node)}`;
  }

  #compileApexExpression(node: ApexExpressionOperandNode): string {
    switch (node.kind) {
      case "ApexAdditionNode": {
        const addition = node as ApexAdditionNode;
        return `(${this.#compileApexExpression(
          addition.leftOperand,
        )} + ${this.#compileApexExpression(addition.rightOperand)})`;
      }
      case "ApexBindNode":
        return (node as ApexBindNode).name;
      case "ApexLiteralNode":
        return this.#compileApexLiteral(node as ApexLiteralNode);
      case "ApexQueryResultNode": {
        const queryResult = node as ApexQueryResultNode;
        return `[${this.compileQuery(queryResult.query).soql}].${queryResult.field}`;
      }
      case "ApexSubstringNode": {
        const substring = node as ApexSubstringNode;
        return `${this.#compileApexExpression(
          substring.source,
        )}.substring(${this.#compileNumericLiteral(
          substring.beginIndex,
        )}, ${this.#compileNumericLiteral(substring.endIndex)})`;
      }
      default:
        throw new Error("Unsupported Apex expression node.");
    }
  }

  #compileApexLiteral(node: ApexLiteralNode): string {
    return typeof node.value === "string"
      ? `'${this.#escapeString(node.value, false)}'`
      : this.#compileNumericLiteral(node.value);
  }

  #compileAggregateFunction(node: AggregateFunctionNode): string {
    const name = {
      avg: "AVG",
      count: "COUNT",
      countDistinct: "COUNT_DISTINCT",
      max: "MAX",
      min: "MIN",
      sum: "SUM",
      grouping: "GROUPING",
    }[node.function];
    const argument = node.reference
      ? this.#compileReference(node.reference)
      : "";

    return `${name}(${argument})`;
  }

  #compileDateFunction(node: DateFunctionNode): string {
    const name = {
      calendarMonth: "CALENDAR_MONTH",
      calendarQuarter: "CALENDAR_QUARTER",
      calendarYear: "CALENDAR_YEAR",
      dayInMonth: "DAY_IN_MONTH",
      dayInWeek: "DAY_IN_WEEK",
      dayInYear: "DAY_IN_YEAR",
      dayOnly: "DAY_ONLY",
      fiscalMonth: "FISCAL_MONTH",
      fiscalQuarter: "FISCAL_QUARTER",
      fiscalYear: "FISCAL_YEAR",
      hourInDay: "HOUR_IN_DAY",
      weekInMonth: "WEEK_IN_MONTH",
      weekInYear: "WEEK_IN_YEAR",
    }[node.function];

    const argument =
      node.reference.kind === "ReferenceNode"
        ? this.#compileReference(node.reference)
        : this.#compileConvertTimezoneFunction(
            node.reference as ConvertTimezoneFunctionNode,
          );

    return `${name}(${argument})`;
  }

  #compileConvertCurrencyFunction(node: ConvertCurrencyFunctionNode): string {
    return `convertCurrency(${this.#compileReference(node.reference)})`;
  }

  #compileConvertTimezoneFunction(node: ConvertTimezoneFunctionNode): string {
    return `convertTimezone(${this.#compileReference(node.reference)})`;
  }

  #compileDistanceFunction(node: DistanceFunctionNode): string {
    return `DISTANCE(${this.#compileReference(node.location)}, ${this.#compileOperation(node.destination)}, '${node.unit}')`;
  }

  #compileGeolocationFunction(node: GeolocationFunctionNode): string {
    return `GEOLOCATION(${node.latitude}, ${node.longitude})`;
  }

  #compileFormatFunction(node: FormatFunctionNode): string {
    return `FORMAT(${this.#compileOperation(node.expression)})`;
  }

  #compileToLabelFunction(node: ToLabelFunctionNode): string {
    return `toLabel(${this.#compileReference(node.reference)})`;
  }

  #compileAlias(node: AliasNode): string {
    return `${this.#compileOperation(node.node)} ${node.alias}`;
  }

  #compileAnd(node: AndNode): string {
    return `${this.#compileOperation(node.left)} AND ${this.#compileOperation(node.right)}`;
  }

  #compileNot(node: NotNode): string {
    const operand = this.#compileOperation(node.operand);

    return node.operand.kind === "OrNode"
      ? `NOT ${operand}`
      : `NOT (${operand})`;
  }

  #compileOr(node: OrNode): string {
    return `(${this.#compileOperation(node.left)} OR ${this.#compileOperation(node.right)})`;
  }

  #compileBinaryOperation(node: BinaryOperationNode): string {
    const operator = node.operator as OperatorNode;
    const left = this.#compileOperation(node.leftOperand);
    const right =
      node.rightOperand.kind === "ValueNode"
        ? this.#compileValue(
            node.rightOperand as ValueNode,
            operator.operator === "like",
          )
        : this.#compileOperation(node.rightOperand);

    return `${left} ${this.#compileOperator(operator)} ${right}`;
  }

  #compileSemiJoinSubquery(query: SemiJoinSubqueryNode): string {
    if (!query.selection) {
      throw new Error(
        "Cannot compile a semi-join or anti-join subquery without a selection.",
      );
    }

    let soql = `SELECT ${this.#compileReference(query.selection)} FROM ${query.from.name}`;

    if (query.where) {
      soql += ` WHERE ${this.#compileWhere(query.where)}`;
    }

    return soql;
  }

  #compileReference(node: ReferenceNode): string {
    return node.name;
  }

  #compileOperator(node: OperatorNode): string {
    switch (node.operator) {
      case "excludes":
        return "EXCLUDES";
      case "in":
        return "IN";
      case "includes":
        return "INCLUDES";
      case "like":
        return "LIKE";
      case "not in":
        return "NOT IN";
      default:
        return node.operator;
    }
  }

  #compileValueList(node: ValueListNode): string {
    return `(${node.values
      .map((value) => this.#compileValue(value))
      .join(", ")})`;
  }

  #compileValue(node: ValueNode, likePattern = false): string {
    const { value } = node;

    if (value === null) {
      return "null";
    }

    if (isSoqlTemporalLiteral(value) || isSoqlRelativeDateLiteral(value)) {
      return value.value;
    }

    if (isSoqlCurrencyLiteral(value)) {
      return `${value.isoCode}${this.#compileNumericLiteral(value.value)}`;
    }

    switch (typeof value) {
      case "string":
        return `'${this.#escapeString(value, likePattern)}'`;
      case "number":
        return this.#compileNumericLiteral(value);
      case "boolean":
        return value ? "TRUE" : "FALSE";
      default:
        throw new TypeError(`Unsupported SOQL literal type: ${typeof value}`);
    }
  }

  #compileNumericLiteral(value: number): string {
    const result = v.safeParse(numericLiteralSchema, value);

    if (!result.success) {
      throw new TypeError(result.issues[0].message);
    }

    return String(result.output);
  }

  #escapeString(value: string, likePattern: boolean): string {
    let escaped = "";

    for (let index = 0; index < value.length; index += 1) {
      const character = value[index];
      const next = value[index + 1];

      if (character === "\\") {
        if (likePattern && (next === "%" || next === "_")) {
          escaped += `\\${next}`;
          index += 1;
        } else {
          escaped += "\\\\";
        }
        continue;
      }

      switch (character) {
        case "'":
          escaped += "\\'";
          break;
        case "\n":
          escaped += "\\n";
          break;
        case "\r":
          escaped += "\\r";
          break;
        case "\t":
          escaped += "\\t";
          break;
        case "\b":
          escaped += "\\b";
          break;
        case "\f":
          escaped += "\\f";
          break;
        default:
          escaped += character;
      }
    }

    return escaped;
  }
}
