import type { AndNode } from "#/operation-node/and-node";
import { BinaryOperationNode } from "#/operation-node/binary-operation-node";
import type { NotNode } from "#/operation-node/not-node";
import type { OperationNode } from "#/operation-node/operation-node";
import {
  type ComparisonOperator,
  OperatorNode,
} from "#/operation-node/operator-node";
import type { OrNode } from "#/operation-node/or-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import type { SemiJoinSubqueryNode } from "#/operation-node/semi-join-subquery-node";
import { parseValueBinaryOperation } from "#/parser/binary-operation-parser";
import { createSemiJoinQueryCreator } from "#/query-builder/semi-join-subquery-builder";

const MAX_SEMI_JOIN_SUBQUERIES = 2;
const SEMI_JOIN_DISABLED_ERROR =
  "SOQL semi-joins and anti-joins are only supported in the top-level WHERE clause.";
const SEMI_JOIN_LEFT_RELATIONSHIP_ERROR =
  "SOQL semi-join and anti-join left operands cannot traverse relationships.";
const SEMI_JOIN_SELECTION_ERROR =
  "SOQL semi-join and anti-join subqueries must select exactly one ID or reference field.";
const SEMI_JOIN_SELF_QUERY_ERROR =
  "SOQL semi-join and anti-join subqueries cannot query the same object as the outer query.";
const SEMI_JOIN_NESTING_ERROR =
  "SOQL semi-join and anti-join subqueries must be top-level WHERE terms and cannot be nested under OR, NOT, or another semi-join/anti-join.";
const SEMI_JOIN_COUNT_ERROR =
  "SOQL WHERE clauses support at most two semi-join or anti-join subqueries.";

export interface FilterBinaryOperationOptions {
  readonly allowSemiJoin?: boolean;
  readonly outerObject?: string;
}

interface RuntimeSemiJoinSubqueryExpression {
  toOperationNode(): SemiJoinSubqueryNode;
}

type RuntimeSemiJoinSubqueryFactory = (
  query: unknown,
) => RuntimeSemiJoinSubqueryExpression;

export function parseFilterBinaryOperation(
  left: string,
  operator: ComparisonOperator,
  right: unknown,
  options: FilterBinaryOperationOptions = {},
): BinaryOperationNode {
  if (
    (operator === "in" || operator === "not in") &&
    typeof right === "function"
  ) {
    if (options.allowSemiJoin === false) {
      throw new TypeError(SEMI_JOIN_DISABLED_ERROR);
    }

    if (left.includes(".")) {
      throw new TypeError(SEMI_JOIN_LEFT_RELATIONSHIP_ERROR);
    }

    const subquery = (right as RuntimeSemiJoinSubqueryFactory)(
      createSemiJoinQueryCreator<Record<string, unknown>, string, string>(),
    ).toOperationNode();

    if (!subquery.selection || subquery.selection.name.includes(".")) {
      throw new TypeError(SEMI_JOIN_SELECTION_ERROR);
    }

    if (options.outerObject && subquery.from.name === options.outerObject) {
      throw new TypeError(SEMI_JOIN_SELF_QUERY_ERROR);
    }

    return BinaryOperationNode.create(
      ReferenceNode.create(left),
      OperatorNode.create(operator),
      subquery,
    );
  }

  return parseValueBinaryOperation(left, operator, right);
}

export function validateSemiJoinWhere(operation: OperationNode): void {
  const count = inspectSemiJoinWhere(operation, false);

  if (count > MAX_SEMI_JOIN_SUBQUERIES) {
    throw new TypeError(SEMI_JOIN_COUNT_ERROR);
  }
}

function inspectSemiJoinWhere(
  node: OperationNode,
  semiJoinForbidden: boolean,
): number {
  switch (node.kind) {
    case "AndNode": {
      const and = node as AndNode;
      return (
        inspectSemiJoinWhere(and.left, semiJoinForbidden) +
        inspectSemiJoinWhere(and.right, semiJoinForbidden)
      );
    }
    case "BinaryOperationNode": {
      const binary = node as BinaryOperationNode;
      return (
        inspectSemiJoinWhere(binary.leftOperand, semiJoinForbidden) +
        inspectSemiJoinWhere(binary.rightOperand, semiJoinForbidden)
      );
    }
    case "NotNode":
      return inspectSemiJoinWhere((node as NotNode).operand, true);
    case "OrNode": {
      const or = node as OrNode;
      return (
        inspectSemiJoinWhere(or.left, true) +
        inspectSemiJoinWhere(or.right, true)
      );
    }
    case "SemiJoinSubqueryNode": {
      if (semiJoinForbidden) {
        throw new TypeError(SEMI_JOIN_NESTING_ERROR);
      }

      const subquery = node as SemiJoinSubqueryNode;

      if (subquery.where) {
        inspectSemiJoinWhere(subquery.where.where, true);
      }

      return 1;
    }
    default:
      return 0;
  }
}
