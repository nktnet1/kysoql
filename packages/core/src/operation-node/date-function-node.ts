import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

export type DateFunction =
  | "calendarMonth"
  | "calendarQuarter"
  | "calendarYear"
  | "dayInMonth"
  | "dayInWeek"
  | "dayInYear"
  | "dayOnly"
  | "fiscalMonth"
  | "fiscalQuarter"
  | "fiscalYear"
  | "hourInDay"
  | "weekInMonth"
  | "weekInYear";

export interface DateFunctionNode {
  readonly kind: "DateFunctionNode";
  readonly function: DateFunction;
  readonly reference: ReferenceNode;
}

export const DateFunctionNode = {
  create(
    dateFunction: DateFunction,
    reference: ReferenceNode,
  ): DateFunctionNode {
    return freeze({
      kind: "DateFunctionNode",
      function: dateFunction,
      reference,
    });
  },
};
