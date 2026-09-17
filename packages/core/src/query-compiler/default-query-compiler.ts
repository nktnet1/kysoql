import type { AndNode } from "../operation-node/and-node.js";
import type { BinaryOperationNode } from "../operation-node/binary-operation-node.js";
import type { OperationNode } from "../operation-node/operation-node.js";
import type { OperatorNode } from "../operation-node/operator-node.js";
import type { ReferenceNode } from "../operation-node/reference-node.js";
import type { SelectQueryNode } from "../operation-node/select-query-node.js";
import type { SelectionNode } from "../operation-node/selection-node.js";
import type { ValueNode } from "../operation-node/value-node.js";
import type { WhereNode } from "../operation-node/where-node.js";
import { isSoqlTemporalLiteral } from "../soql-temporal-literal.js";
import { freeze } from "../util/object-utils.js";
import type { CompiledQuery } from "./compiled-query.js";
import type { QueryCompiler } from "./query-compiler.js";

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

    return soql;
  }

  #compileSelection(selection: SelectionNode): string {
    return this.#compileReference(selection.selection);
  }

  #compileWhere(where: WhereNode): string {
    return this.#compileOperation(where.where);
  }

  #compileOperation(node: OperationNode): string {
    switch (node.kind) {
      case "AndNode":
        return this.#compileAnd(node as AndNode);
      case "BinaryOperationNode":
        return this.#compileBinaryOperation(node as BinaryOperationNode);
      case "ReferenceNode":
        return this.#compileReference(node as ReferenceNode);
      case "OperatorNode":
        return this.#compileOperator(node as OperatorNode);
      case "ValueNode":
        return this.#compileValue(node as ValueNode);
      default:
        throw new Error(`Unsupported operation node: ${node.kind}`);
    }
  }

  #compileAnd(node: AndNode): string {
    return `${this.#compileOperation(node.left)} AND ${this.#compileOperation(node.right)}`;
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
    return node.operator === "like" ? "LIKE" : node.operator;
  }

  #compileValue(node: ValueNode, likePattern = false): string {
    const { value } = node;

    if (value === null) {
      return "null";
    }

    if (isSoqlTemporalLiteral(value)) {
      return value.value;
    }

    switch (typeof value) {
      case "string":
        return `'${this.#escapeString(value, likePattern)}'`;
      case "number":
        if (!Number.isFinite(value)) {
          throw new TypeError("SOQL numeric literals must be finite numbers.");
        }
        return String(value);
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
