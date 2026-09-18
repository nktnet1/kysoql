import * as v from "valibot";

import type { AndNode } from "#/operation-node/and-node";
import type { BinaryOperationNode } from "#/operation-node/binary-operation-node";
import type { OperationNode } from "#/operation-node/operation-node";
import type { LimitNode } from "#/operation-node/limit-node";
import type { OffsetNode } from "#/operation-node/offset-node";
import type { NotNode } from "#/operation-node/not-node";
import type { OrNode } from "#/operation-node/or-node";
import type { OperatorNode } from "#/operation-node/operator-node";
import type { OrderByItemNode } from "#/operation-node/order-by-item-node";
import type { OrderByNode } from "#/operation-node/order-by-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import type { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";
import type { SelectQueryNode } from "#/operation-node/select-query-node";
import type { SelectionNode } from "#/operation-node/selection-node";
import type { ValueListNode } from "#/operation-node/value-list-node";
import type { ValueNode } from "#/operation-node/value-node";
import type { WhereNode } from "#/operation-node/where-node";
import { isSoqlRelativeDateLiteral } from "#/soql-relative-date-literal";
import { isSoqlTemporalLiteral } from "#/soql-temporal-literal";
import { freeze } from "#/util/object-utils";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";

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

    let soql = `SELECT ${query.selections.map((selection) => this.#compileSelection(selection)).join(", ")} FROM ${query.from.name}`;

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

  #compileSelection(selection: SelectionNode): string {
    switch (selection.selection.kind) {
      case "ReferenceNode":
        return this.#compileReference(selection.selection as ReferenceNode);
      case "RelationshipSubqueryNode":
        return `(${this.#compileRelationshipSubquery(
          selection.selection as RelationshipSubqueryNode,
        )})`;
      default:
        throw new Error("Unsupported selection node.");
    }
  }

  #compileRelationshipSubquery(query: RelationshipSubqueryNode): string {
    if (!query.selections?.length) {
      throw new Error("Cannot compile a relationship subquery without selections.");
    }

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

  #compileLimit(limit: LimitNode): string {
    return String(limit.limit);
  }

  #compileOffset(offset: OffsetNode): string {
    return String(offset.offset);
  }

  #compileOrderBy(orderBy: OrderByNode): string {
    return orderBy.items.map((item) => this.#compileOrderByItem(item)).join(", ");
  }

  #compileOrderByItem(item: OrderByItemNode): string {
    let orderBy = this.#compileReference(item.orderBy);

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
      case "AndNode":
        return this.#compileAnd(node as AndNode);
      case "BinaryOperationNode":
        return this.#compileBinaryOperation(node as BinaryOperationNode);
      case "NotNode":
        return this.#compileNot(node as NotNode);
      case "OrNode":
        return this.#compileOr(node as OrNode);
      case "ReferenceNode":
        return this.#compileReference(node as ReferenceNode);
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
        ? this.#compileValue(node.rightOperand as ValueNode, operator.operator === "like")
        : this.#compileOperation(node.rightOperand);

    return `${left} ${this.#compileOperator(operator)} ${right}`;
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

    switch (typeof value) {
      case "string":
        return `'${this.#escapeString(value, likePattern)}'`;
      case "number": {
        const result = v.safeParse(numericLiteralSchema, value);

        if (!result.success) {
          throw new TypeError(result.issues[0].message);
        }

        return String(result.output);
      }
      case "boolean":
        return value ? "TRUE" : "FALSE";
      default:
        throw new TypeError(
          `Unsupported SOQL literal type: ${typeof value}`,
        );
    }
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
