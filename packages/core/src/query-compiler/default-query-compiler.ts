import * as v from "valibot";

import type { AggregateFunctionNode } from "#src/operation-node/aggregate-function-node";
import type { AliasNode } from "#src/operation-node/alias-node";
import type { AndNode } from "#src/operation-node/and-node";
import type { ApexBindNode } from "#src/operation-node/apex-bind-node";
import type {
  ApexAdditionNode,
  ApexBindExpressionNode,
  ApexExpressionOperandNode,
  ApexQueryResultNode,
  ApexSubstringNode,
} from "#src/operation-node/apex-expression-node";
import type { ApexLiteralNode } from "#src/operation-node/apex-literal-node";
import type { BinaryOperationNode } from "#src/operation-node/binary-operation-node";
import type { ConvertCurrencyFunctionNode } from "#src/operation-node/convert-currency-function-node";
import type { ConvertTimezoneFunctionNode } from "#src/operation-node/convert-timezone-function-node";
import type { DateFunctionNode } from "#src/operation-node/date-function-node";
import type { DistanceFunctionNode } from "#src/operation-node/distance-function-node";
import type { FieldsFunctionNode } from "#src/operation-node/fields-function-node";
import type { ForViewReferenceNode } from "#src/operation-node/for-view-reference-node";
import type { FormatFunctionNode } from "#src/operation-node/format-function-node";
import type { FormulaFunctionNode } from "#src/operation-node/formula-function-node";
import { GeolocationFunctionNode } from "#src/operation-node/geolocation-function-node";
import type { GroupByNode } from "#src/operation-node/group-by-node";
import type { HavingNode } from "#src/operation-node/having-node";
import type { KnowledgeUpdateNode } from "#src/operation-node/knowledge-update-node";
import type { LimitNode } from "#src/operation-node/limit-node";
import type { NotNode } from "#src/operation-node/not-node";
import type { OffsetNode } from "#src/operation-node/offset-node";
import type { OperationNode } from "#src/operation-node/operation-node";
import type { OperatorNode } from "#src/operation-node/operator-node";
import type { OrNode } from "#src/operation-node/or-node";
import type { OrderByItemNode } from "#src/operation-node/order-by-item-node";
import type { OrderByNode } from "#src/operation-node/order-by-node";
import { isRawNode, type RawNode } from "#src/operation-node/raw-node";
import type { RecordVisibilityContextNode } from "#src/operation-node/record-visibility-context-node";
import type { ReferenceNode } from "#src/operation-node/reference-node";
import type { RelationshipSubqueryNode } from "#src/operation-node/relationship-subquery-node";
import type { SelectQueryNode } from "#src/operation-node/select-query-node";
import type { SelectionNode } from "#src/operation-node/selection-node";
import type { SemiJoinSubqueryNode } from "#src/operation-node/semi-join-subquery-node";
import type { SetOptionsNode } from "#src/operation-node/set-options-node";
import type { ToLabelFunctionNode } from "#src/operation-node/to-label-function-node";
import type { TypeOfNode } from "#src/operation-node/type-of-node";
import type { UserProfileFeedWithNode } from "#src/operation-node/user-profile-feed-with-node";
import type { UsingScopeNode } from "#src/operation-node/using-scope-node";
import type { ValueListNode } from "#src/operation-node/value-list-node";
import type { ValueNode } from "#src/operation-node/value-node";
import type { WhereNode } from "#src/operation-node/where-node";
import type {
  DataCategorySelectionNode,
  WithDataCategoryNode,
} from "#src/operation-node/with-data-category-node";
import { validateAllRowsQuery } from "#src/parser/all-rows-parser";
import { validateApexAccessModeQuery } from "#src/parser/apex-access-mode-parser";
import { validateApexBindQuery } from "#src/parser/apex-bind-parser";
import { validateDataCategoryQuery } from "#src/parser/data-category-parser";
import { validateData360QueryLimits } from "#src/parser/data360-query-limit-parser";
import { validateFieldsSelections } from "#src/parser/fields-selection-parser";
import { validateForUpdateQuery } from "#src/parser/for-update-parser";
import { validateGroupByQuery } from "#src/parser/group-by-parser";
import { validateKnowledgeUpdateQuery } from "#src/parser/knowledge-update-parser";
import { validateObjectQueryLimits } from "#src/parser/object-query-limit-parser";
import { validateRecordVisibilityContextQuery } from "#src/parser/record-visibility-context-parser";
import {
  validateRelationshipQueryLimits,
  validateRelationshipSubqueryOffsets,
} from "#src/parser/relationship-query-limit-parser";
import { parseSelectionAlias } from "#src/parser/selection-alias-parser";
import { validateSetOptionsQuery } from "#src/parser/set-options-parser";
import { validateTypeOfSelections } from "#src/parser/type-of-parser";
import { validateUserProfileFeedQuery } from "#src/parser/user-profile-feed-parser";
import type { CompiledQuery } from "#src/query-compiler/compiled-query";
import type {
  QueryCompileContext,
  QueryCompiler,
} from "#src/query-compiler/query-compiler";
import type { SalesforceSchemaMetadata } from "#src/schema";
import { isSoqlCurrencyLiteral } from "#src/soql-currency-literal";
import { parseSoqlIdentifier, parseSoqlReference } from "#src/soql-identifier";
import { isSoqlLikeLiteral } from "#src/soql-like-literal";
import { isSoqlRelativeDateLiteral } from "#src/soql-relative-date-literal";
import { isSoqlTemporalLiteral } from "#src/soql-temporal-literal";
import { freeze } from "#src/util/object-utils";

const NUMERIC_LITERAL_ERROR = "SOQL numeric literals must be finite numbers.";
const numericLiteralSchema = v.pipe(
  v.number(NUMERIC_LITERAL_ERROR),
  v.finite(NUMERIC_LITERAL_ERROR),
);

/**
 * Default compiler that validates a query AST and renders Salesforce SOQL.
 */
export class DefaultQueryCompiler implements QueryCompiler {
  readonly #schemaMetadata: SalesforceSchemaMetadata | undefined;

  /** Creates a query compiler, optionally using generated schema metadata for validation. */
  constructor(schemaMetadata?: SalesforceSchemaMetadata) {
    this.#schemaMetadata = schemaMetadata;
  }

  /** Compiles a Kysoql operation tree into SOQL. */
  compileQuery<O = unknown>(
    query: SelectQueryNode,
    context: QueryCompileContext = {},
  ): CompiledQuery<O> {
    return freeze({
      query,
      soql: this.#compileSelectQuery(query, context),
    });
  }

  #compileSelectQuery(
    query: SelectQueryNode,
    context: QueryCompileContext,
  ): string {
    if (!query.selections?.length) {
      throw new Error("Cannot compile a SELECT query without selections.");
    }

    validateFieldsSelections(query.selections, query.limit, {
      apex: context.apex === true,
      where: query.where,
    });
    validateAllRowsQuery(query);
    validateApexAccessModeQuery(query);
    validateApexBindQuery(query);
    validateForUpdateQuery(query);
    validateGroupByQuery(query);
    validateTypeOfSelections(query);
    validateKnowledgeUpdateQuery(query);
    validateRecordVisibilityContextQuery(query);
    validateUserProfileFeedQuery(query);
    validateRelationshipQueryLimits(query);
    validateRelationshipSubqueryOffsets(query);
    validateObjectQueryLimits(query, this.#schemaMetadata);
    validateData360QueryLimits(query, this.#schemaMetadata);
    validateSetOptionsQuery(
      query,
      context.apex === true && context.dynamicApex === true,
    );

    let soql = `SELECT ${this.#compileSelections(
      query.selections,
      context,
      query.groupBy !== undefined,
    )} FROM ${parseSoqlIdentifier(query.from.name)}`;

    if (query.usingScope) {
      soql += ` USING SCOPE ${this.#compileUsingScope(query.usingScope)}`;
    }

    if (query.where) {
      soql += ` WHERE ${this.#compileWhere(query.where)}`;
    }

    if (query.recordVisibilityContext) {
      soql += ` WITH ${this.#compileRecordVisibilityContext(query.recordVisibilityContext)}`;
    }

    if (query.userProfileFeedWith) {
      soql += ` WITH ${this.#compileUserProfileFeedWith(query.userProfileFeedWith)}`;
    }

    if (query.withDataCategory) {
      validateDataCategoryQuery(query);
      soql += ` WITH DATA CATEGORY ${this.#compileWithDataCategory(query.withDataCategory)}`;
    }

    if (query.apexAccessMode) {
      const mode = query.apexAccessMode.mode;
      if (mode !== "user" && mode !== "system") {
        throw new TypeError("Apex SOQL access mode must be user or system.");
      }
      soql += ` WITH ${mode.toUpperCase()}_MODE`;
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

    if (query.setOptions) {
      soql += ` SET OPTIONS ${this.#compileSetOptions(query.setOptions)}`;
    }

    return soql;
  }

  #compileSelections(
    selections: readonly SelectionNode[],
    context: QueryCompileContext,
    referenceAliases: boolean,
  ): string {
    const references = new Set<string>();
    const compiled: string[] = [];

    for (const selection of selections) {
      const reference = this.#plainSelectionReference(selection);
      if (!referenceAliases && reference) {
        if (references.has(reference.name)) {
          continue;
        }
        references.add(reference.name);
      }

      compiled.push(
        this.#compileSelection(selection, context, referenceAliases),
      );
    }

    return compiled.join(", ");
  }

  #plainSelectionReference(
    selection: SelectionNode,
  ): ReferenceNode | undefined {
    const selected = selection.selection;
    if (selected.kind === "ReferenceNode") {
      return selected;
    }
    if (
      selected.kind === "AliasNode" &&
      selected.node.kind === "ReferenceNode"
    ) {
      return selected.node as ReferenceNode;
    }
    return undefined;
  }

  #compileSelection(
    selection: SelectionNode,
    context: QueryCompileContext,
    referenceAliases: boolean,
  ): string {
    switch (selection.selection.kind) {
      case "AggregateFunctionNode":
        return this.#compileAggregateFunction(
          selection.selection as AggregateFunctionNode,
        );
      case "AliasNode":
        return this.#compileSelectionAlias(
          selection.selection as AliasNode,
          referenceAliases,
        );
      case "DateFunctionNode":
        return this.#compileDateFunction(
          selection.selection as DateFunctionNode,
        );
      case "FieldsFunctionNode":
        return this.#compileFieldsFunction(
          selection.selection as FieldsFunctionNode,
        );
      case "RawNode":
        return this.#compileRaw(selection.selection as RawNode);
      case "ReferenceNode":
        return this.#compileReference(selection.selection as ReferenceNode);
      case "RelationshipSubqueryNode":
        return `(${this.#compileRelationshipSubquery(
          selection.selection as RelationshipSubqueryNode,
          context,
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
          `WHEN ${parseSoqlIdentifier(when.object)} THEN ${when.selections
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

  #compileRelationshipSubquery(
    query: RelationshipSubqueryNode,
    context: QueryCompileContext,
  ): string {
    if (!query.selections?.length) {
      throw new Error(
        "Cannot compile a relationship subquery without selections.",
      );
    }

    validateFieldsSelections(query.selections, query.limit, {
      apex: context.apex === true,
      where: query.where,
    });

    let soql = `SELECT ${this.#compileSelections(
      query.selections,
      context,
      false,
    )} FROM ${this.#compileReference(query.relationship)}`;

    if (query.where) {
      soql += ` WHERE ${this.#compileWhere(query.where)}`;
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

    return soql;
  }

  #compileWhere(where: WhereNode): string {
    return this.#compileOperation(where.where);
  }

  #compileSetOptions(node: SetOptionsNode): string {
    if (node.apexQueryOptions) {
      return this.#compileApexBind(node.apexQueryOptions);
    }

    const options: string[] = [];

    if (node.dataspace) {
      options.push(`dataspace=${this.#compileValue(node.dataspace)}`);
    }
    if (node.honorEmptyStrings !== undefined) {
      options.push(`honorEmptyStrings=${String(node.honorEmptyStrings)}`);
    }

    return `(${options.join(", ")})`;
  }

  #compileRecordVisibilityContext(node: RecordVisibilityContextNode): string {
    const parameters: string[] = [];

    if (node.maxDescriptorPerRecord !== undefined) {
      parameters.push(`maxDescriptorPerRecord=${node.maxDescriptorPerRecord}`);
    }
    if (node.supportsDomains !== undefined) {
      parameters.push(`supportsDomains=${String(node.supportsDomains)}`);
    }
    if (node.supportsDelegates !== undefined) {
      parameters.push(`supportsDelegates=${String(node.supportsDelegates)}`);
    }

    return `RecordVisibilityContext (${parameters.join(", ")})`;
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
    if (
      node.selector !== "all" &&
      node.selector !== "custom" &&
      node.selector !== "standard"
    ) {
      throw new TypeError(
        "SOQL FIELDS() selector must be all, custom, or standard.",
      );
    }

    return `FIELDS(${node.selector.toUpperCase()})`;
  }

  #compileOffset(offset: OffsetNode<number | ApexBindExpressionNode>): string {
    return typeof offset.offset === "number"
      ? String(offset.offset)
      : this.#compileApexBind(offset.offset);
  }

  #compileUsingScope(usingScope: UsingScopeNode): string {
    return parseSoqlIdentifier(usingScope.scope);
  }

  #compileUserProfileFeedWith(node: UserProfileFeedWithNode): string {
    return `UserId = ${this.#compileValue(node.userId)}`;
  }

  #compileForViewReference(node: ForViewReferenceNode): string {
    switch (node.mode) {
      case "view":
        return "VIEW";
      case "reference":
        return "REFERENCE";
      default:
        throw new TypeError("SOQL FOR mode must be view or reference.");
    }
  }

  #compileKnowledgeUpdate(node: KnowledgeUpdateNode): string {
    return node.modes
      .map((mode) => {
        switch (mode) {
          case "tracking":
            return "TRACKING";
          case "viewstat":
            return "VIEWSTAT";
          default:
            throw new TypeError(
              "SOQL UPDATE mode must be tracking or viewstat.",
            );
        }
      })
      .join(", ");
  }

  #compileGroupBy(groupBy: GroupByNode): string {
    const fields = groupBy.items
      .map((item) => this.#compileOperation(item))
      .join(", ");

    if (!groupBy.mode) {
      return fields;
    }

    if (groupBy.mode !== "rollup" && groupBy.mode !== "cube") {
      throw new TypeError("SOQL GROUP BY mode must be rollup or cube.");
    }

    return `${groupBy.mode.toUpperCase()}(${fields})`;
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
      if (item.direction !== "asc" && item.direction !== "desc") {
        throw new TypeError("SOQL ORDER BY direction must be asc or desc.");
      }
      orderBy += ` ${item.direction.toUpperCase()}`;
    }

    if (item.nulls) {
      if (item.nulls !== "first" && item.nulls !== "last") {
        throw new TypeError(
          "SOQL ORDER BY null placement must be first or last.",
        );
      }
      orderBy += ` NULLS ${item.nulls.toUpperCase()}`;
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
      case "FormulaFunctionNode":
        return this.#compileFormulaFunction(node as FormulaFunctionNode);
      case "GeolocationFunctionNode":
        return this.#compileGeolocationFunction(
          node as GeolocationFunctionNode,
        );
      case "NotNode":
        return this.#compileNot(node as NotNode);
      case "OrNode":
        return this.#compileOr(node as OrNode);
      case "RawNode":
        return this.#compileRaw(node as RawNode);
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
        return parseSoqlReference((node as ApexBindNode).name);
      case "ApexLiteralNode":
        return this.#compileApexLiteral(node as ApexLiteralNode);
      case "ApexQueryResultNode": {
        const queryResult = node as ApexQueryResultNode;
        return `[${this.compileQuery(queryResult.query, { apex: true }).soql}].${parseSoqlIdentifier(
          queryResult.field,
        )}`;
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
    if (node.unit !== "mi" && node.unit !== "km") {
      throw new TypeError("SOQL DISTANCE() unit must be 'mi' or 'km'.");
    }

    return `DISTANCE(${this.#compileReference(node.location)}, ${this.#compileOperation(node.destination)}, '${node.unit}')`;
  }

  #compileGeolocationFunction(node: GeolocationFunctionNode): string {
    const parsed = GeolocationFunctionNode.create(
      node.latitude,
      node.longitude,
    );
    return `GEOLOCATION(${parsed.latitude}, ${parsed.longitude})`;
  }

  #compileFormatFunction(node: FormatFunctionNode): string {
    return `FORMAT(${this.#compileOperation(node.expression)})`;
  }

  #compileFormulaFunction(node: FormulaFunctionNode): string {
    const expression = `${this.#compileReference(node.leftOperand)} ${
      node.operator
    } ${this.#compileReference(node.rightOperand)}`;
    return `FORMULA('${this.#escapeString(expression, false)}')`;
  }

  #compileToLabelFunction(node: ToLabelFunctionNode): string {
    return `toLabel(${this.#compileReference(node.reference)})`;
  }

  #compileSelectionAlias(node: AliasNode, referenceAliases: boolean): string {
    if (node.node.kind === "ReferenceNode" && !referenceAliases) {
      return this.#compileReference(node.node as ReferenceNode);
    }

    return this.#compileAlias(node);
  }

  #compileAlias(node: AliasNode): string {
    return `${this.#compileOperation(node.node)} ${parseSelectionAlias(node.alias)}`;
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

    let soql = `SELECT ${this.#compileReference(
      query.selection,
    )} FROM ${parseSoqlIdentifier(query.from.name)}`;

    if (query.where) {
      soql += ` WHERE ${this.#compileWhere(query.where)}`;
    }

    return soql;
  }

  #compileRaw(node: RawNode): string {
    if (!isRawNode(node)) {
      throw new TypeError(
        "SOQL raw fragments must be created with soql.raw().",
      );
    }

    return node.soql;
  }

  #compileReference(node: ReferenceNode): string {
    return parseSoqlReference(node.name);
  }

  #compileOperator(node: OperatorNode): string {
    switch (node.operator) {
      case "=":
      case "!=":
      case "<":
      case "<=":
      case ">":
      case ">=":
        return node.operator;
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
        throw new TypeError("Unsupported SOQL comparison operator.");
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

    if (isSoqlLikeLiteral(value)) {
      if (!likePattern) {
        throw new TypeError(
          "soql.likeLiteral() can only be used as a LIKE operand.",
        );
      }
      return `'${this.#escapeLikeLiteral(value.value)}'`;
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

  #escapeLikeLiteral(value: string): string {
    let pattern = "";

    for (const character of value) {
      pattern +=
        character === "%" || character === "_" ? `\\${character}` : character;
    }

    return this.#escapeString(pattern, true);
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
