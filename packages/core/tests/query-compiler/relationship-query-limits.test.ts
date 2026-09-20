import { describe, expect, it } from "vitest";

import { BinaryOperationNode } from "#/operation-node/binary-operation-node";
import { OperatorNode } from "#/operation-node/operator-node";
import { OrderByItemNode } from "#/operation-node/order-by-item-node";
import { QueryNode } from "#/operation-node/query-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import { SelectionNode } from "#/operation-node/selection-node";
import { SObjectNode } from "#/operation-node/sobject-node";
import { TypeOfNode } from "#/operation-node/type-of-node";
import { ValueNode } from "#/operation-node/value-node";
import { DefaultQueryCompiler } from "#/query-compiler/default-query-compiler";

const compiler = new DefaultQueryCompiler();

const fieldSelection = (name: string): SelectionNode =>
  SelectionNode.create(ReferenceNode.create(name));

const relationshipQuerySelection = (
  relationship: string,
  selections: readonly SelectionNode[],
): SelectionNode =>
  SelectionNode.create(
    RelationshipSubqueryNode.cloneWithSelections(
      RelationshipSubqueryNode.create(ReferenceNode.create(relationship)),
      selections,
    ),
  );

const relationshipSelection = (
  relationship: string,
  fields: readonly string[] = ["Id"],
): SelectionNode =>
  relationshipQuerySelection(relationship, fields.map(fieldSelection));

const rootQuery = (selections: readonly SelectionNode[]) =>
  SelectQueryNode.cloneWithSelections(
    SelectQueryNode.createFrom(SObjectNode.create("Account")),
    selections,
  );

const parentReferences = (count: number): SelectionNode[] =>
  Array.from({ length: count }, (_, index) =>
    fieldSelection(`Relationship${index + 1}.Name`),
  );

describe("SOQL relationship query limits", () => {
  it("accepts 20 parent-to-child relationships and rejects the 21st", () => {
    const twenty = rootQuery([
      fieldSelection("Id"),
      ...Array.from({ length: 20 }, (_, index) =>
        relationshipSelection(`Children${index + 1}`),
      ),
    ]);
    const twentyOne = rootQuery([
      fieldSelection("Id"),
      ...Array.from({ length: 21 }, (_, index) =>
        relationshipSelection(`Children${index + 1}`),
      ),
    ]);

    expect(() => compiler.compileQuery(twenty)).not.toThrow();
    expect(() => compiler.compileQuery(twentyOne)).toThrow(
      "SOQL queries can specify no more than 20 parent-to-child relationships.",
    );
  });

  it("counts nested parent-to-child relationships across the whole query", () => {
    const nested = relationshipQuerySelection("Contacts", [
      fieldSelection("Id"),
      relationshipSelection("Cases"),
    ]);
    const query = rootQuery([
      fieldSelection("Id"),
      ...Array.from({ length: 19 }, (_, index) =>
        relationshipSelection(`Children${index + 1}`),
      ),
      nested,
    ]);

    expect(() => compiler.compileQuery(query)).toThrow(
      "SOQL queries can specify no more than 20 parent-to-child relationships.",
    );
  });

  it("accepts 55 child-to-parent relationships and rejects the 56th", () => {
    const fiftyFive = rootQuery([fieldSelection("Id"), ...parentReferences(55)]);
    const fiftySix = rootQuery([fieldSelection("Id"), ...parentReferences(56)]);

    expect(() => compiler.compileQuery(fiftyFive)).not.toThrow();
    expect(() => compiler.compileQuery(fiftySix)).toThrow(
      "SOQL queries can specify no more than 55 child-to-parent relationships.",
    );
  });

  it("counts unique relationship-path prefixes instead of field references", () => {
    const repeatedPaths = Array.from({ length: 40 }, (_, index) =>
      fieldSelection(
        index % 2 === 0 ? "Owner.Manager.Name" : "Owner.Manager.Email",
      ),
    );
    let query = rootQuery([fieldSelection("Id"), ...repeatedPaths]);

    query = QueryNode.cloneWithWhere(
      query,
      BinaryOperationNode.create(
        ReferenceNode.create("Owner.Manager.IsActive"),
        OperatorNode.create("="),
        ValueNode.create(true),
      ),
    );
    query = SelectQueryNode.cloneWithOrderByItems(query, [
      OrderByItemNode.create(ReferenceNode.create("Owner.Manager.Name")),
    ]);

    expect(() => compiler.compileQuery(query)).not.toThrow();
  });

  it("counts every relationship prefix in a multi-level parent path", () => {
    const query = rootQuery([
      fieldSelection("Id"),
      ...Array.from({ length: 28 }, (_, index) =>
        fieldSelection(`Relationship${index + 1}.Parent.Name`),
      ),
    ]);

    expect(() => compiler.compileQuery(query)).toThrow(
      "SOQL queries can specify no more than 55 child-to-parent relationships.",
    );
  });

  it("counts child-to-parent paths inside relationship subqueries query-wide", () => {
    const query = rootQuery([
      fieldSelection("Id"),
      ...parentReferences(55),
      relationshipSelection("Contacts", ["Owner.Name"]),
    ]);

    expect(() => compiler.compileQuery(query)).toThrow(
      "SOQL queries can specify no more than 55 child-to-parent relationships.",
    );
  });

  it("counts explicit TYPEOF polymorphic targets against the relationship limit", () => {
    const typeOf = TypeOfNode.cloneWithWhen(
      TypeOfNode.create(ReferenceNode.create("What")),
      "Account",
      [ReferenceNode.create("Name")],
    );
    const atLimit = rootQuery([
      fieldSelection("Id"),
      ...parentReferences(53),
      SelectionNode.create(typeOf),
    ]);
    const overLimit = rootQuery([
      fieldSelection("Id"),
      ...parentReferences(54),
      SelectionNode.create(typeOf),
    ]);

    expect(() => compiler.compileQuery(atLimit)).not.toThrow();
    expect(() => compiler.compileQuery(overLimit)).toThrow(
      "SOQL queries can specify no more than 55 child-to-parent relationships.",
    );
  });

  it("collapses polymorphic target counts for a single root record selected by Id", () => {
    const typeOf = TypeOfNode.cloneWithWhen(
      TypeOfNode.create(ReferenceNode.create("What")),
      "Account",
      [ReferenceNode.create("Name")],
    );
    let query = rootQuery([
      fieldSelection("Id"),
      ...parentReferences(54),
      SelectionNode.create(typeOf),
    ]);

    query = QueryNode.cloneWithWhere(
      query,
      BinaryOperationNode.create(
        ReferenceNode.create("Id"),
        OperatorNode.create("="),
        ValueNode.create("00U000000000001"),
      ),
    );

    expect(() => compiler.compileQuery(query)).not.toThrow();
  });
});
