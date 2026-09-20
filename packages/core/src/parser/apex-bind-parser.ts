import { type ApexBindExpression, isApexBindExpression } from "#/apex-bind";
import type { AndNode } from "#/operation-node/and-node";
import type {
  ApexAdditionNode,
  ApexBindExpressionNode,
  ApexQueryResultNode,
  ApexSubstringNode,
} from "#/operation-node/apex-expression-node";
import { BinaryOperationNode } from "#/operation-node/binary-operation-node";
import { LimitNode } from "#/operation-node/limit-node";
import type { NotNode } from "#/operation-node/not-node";
import { OffsetNode } from "#/operation-node/offset-node";
import type { OperationNode } from "#/operation-node/operation-node";
import {
  type ComparisonOperator,
  type LikeComparisonOperator,
  type MultiSelectComparisonOperator,
  OperatorNode,
  type OrderedComparisonOperator,
  type SetComparisonOperator,
} from "#/operation-node/operator-node";
import type { OrNode } from "#/operation-node/or-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import type { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";
import type { SelectQueryNode } from "#/operation-node/select-query-node";
import type { SelectionNode } from "#/operation-node/selection-node";
import {
  type ComparisonOperatorExpression,
  type OperandValueExpression,
  parseOperationValueBinaryOperation,
} from "#/parser/binary-operation-parser";
import {
  type FilterBinaryOperationOptions,
  parseFilterBinaryOperation,
} from "#/parser/filter-parser";
import { parseLimit } from "#/parser/limit-parser";
import { parseOffset } from "#/parser/offset-parser";
import type { FieldReferenceDefinition } from "#/parser/reference-parser";
import type { SalesforceFieldValue } from "#/schema";

const KNOWLEDGE_APEX_BIND_ERROR =
  "Apex SOQL bind expressions are not supported for KnowledgeArticleVersion objects.";
const MULTISELECT_APEX_BIND_ERROR =
  "Apex SOQL bind expressions are not supported as INCLUDES or EXCLUDES values.";
const APEX_BIND_LEFT_OPERATOR_ERROR =
  "Left-hand Apex bind expressions are supported only with INCLUDES.";

type ApexFieldValue<
  DB,
  TB extends keyof DB,
  RE extends string,
> = SalesforceFieldValue<FieldReferenceDefinition<DB, TB, RE>>;

type ApexScalarBindValue<
  DB,
  TB extends keyof DB,
  RE extends string,
  OP extends ComparisonOperatorExpression<DB, TB, RE>,
> = OP extends LikeComparisonOperator
  ? Extract<NonNullable<ApexFieldValue<DB, TB, RE>>, string>
  : OP extends OrderedComparisonOperator
    ? NonNullable<ApexFieldValue<DB, TB, RE>>
    : ApexFieldValue<DB, TB, RE>;

type ApexBindOperandValueExpression<
  DB,
  TB extends keyof DB,
  RE extends string,
  OP extends ComparisonOperatorExpression<DB, TB, RE>,
> = OP extends MultiSelectComparisonOperator
  ? never
  : OP extends SetComparisonOperator
    ? ApexBindExpression<readonly ApexFieldValue<DB, TB, RE>[]>
    : ApexBindExpression<ApexScalarBindValue<DB, TB, RE, OP>>;

export type ApexOperandValueExpression<
  DB,
  TB extends keyof DB,
  RE extends string,
  OP extends ComparisonOperatorExpression<DB, TB, RE>,
  AllowSemiJoin extends boolean = true,
> =
  | OperandValueExpression<DB, TB, RE, OP, AllowSemiJoin>
  | ApexBindOperandValueExpression<DB, TB, RE, OP>;

export function parseApexLimit(
  limit: number | ApexBindExpression<number>,
): LimitNode<number | ApexBindExpressionNode> {
  return isApexBindExpression(limit)
    ? LimitNode.create(limit.toOperationNode())
    : parseLimit(limit);
}

export function parseApexOffset(
  offset: number | ApexBindExpression<number>,
): OffsetNode<number | ApexBindExpressionNode> {
  return isApexBindExpression(offset)
    ? OffsetNode.create(offset.toOperationNode())
    : parseOffset(offset);
}

export function parseApexFilterBinaryOperation(
  left: string | ApexBindExpression<string>,
  operator: ComparisonOperator,
  right: unknown,
  options: FilterBinaryOperationOptions = {},
): BinaryOperationNode {
  if (isApexBindExpression(left)) {
    if (operator !== "includes") {
      throw new TypeError(APEX_BIND_LEFT_OPERATOR_ERROR);
    }

    return parseOperationValueBinaryOperation(
      left.toOperationNode(),
      operator,
      right,
    );
  }

  if (!isApexBindExpression(right)) {
    return parseFilterBinaryOperation(left, operator, right, options);
  }

  if (operator === "includes" || operator === "excludes") {
    throw new TypeError(MULTISELECT_APEX_BIND_ERROR);
  }

  return BinaryOperationNode.create(
    ReferenceNode.create(left),
    OperatorNode.create(operator),
    right.toOperationNode(),
  );
}

const containsApexBind = (node: OperationNode): boolean => {
  switch (node.kind) {
    case "ApexAdditionNode": {
      const addition = node as ApexAdditionNode;
      containsApexBind(addition.leftOperand);
      containsApexBind(addition.rightOperand);
      return true;
    }
    case "ApexBindNode":
      return true;
    case "ApexQueryResultNode": {
      const queryResult = node as ApexQueryResultNode;
      validateApexBindQuery(queryResult.query);
      return true;
    }
    case "ApexSubstringNode":
      containsApexBind((node as ApexSubstringNode).source);
      return true;
    case "AndNode": {
      const and = node as AndNode;
      return containsApexBind(and.left) || containsApexBind(and.right);
    }
    case "BinaryOperationNode": {
      const binary = node as BinaryOperationNode;
      return (
        containsApexBind(binary.leftOperand) ||
        containsApexBind(binary.rightOperand)
      );
    }
    case "NotNode":
      return containsApexBind((node as NotNode).operand);
    case "OrNode": {
      const or = node as OrNode;
      return containsApexBind(or.left) || containsApexBind(or.right);
    }
    case "RelationshipSubqueryNode": {
      const subquery = node as RelationshipSubqueryNode;

      return (
        (subquery.where ? containsApexBind(subquery.where.where) : false) ||
        (subquery.selections?.some(containsApexBind) ?? false)
      );
    }
    case "SelectionNode":
      return containsApexBind((node as SelectionNode).selection);
    default:
      return false;
  }
};

const isKnowledgeArticleObject = (objectName: string): boolean => {
  const normalized = objectName.toLowerCase();

  return (
    normalized === "knowledgearticleversion" || normalized.endsWith("__kav")
  );
};

export function validateApexBindQuery(query: SelectQueryNode): void {
  const hasBind =
    (query.where ? containsApexBind(query.where.where) : false) ||
    (query.selections?.some(containsApexBind) ?? false) ||
    (query.limit ? typeof query.limit.limit !== "number" : false) ||
    (query.offset ? typeof query.offset.offset !== "number" : false);

  if (isKnowledgeArticleObject(query.from.name) && hasBind) {
    throw new TypeError(KNOWLEDGE_APEX_BIND_ERROR);
  }
}
