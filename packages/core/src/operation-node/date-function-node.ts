import type { ConvertTimezoneFunctionNode } from "#/operation-node/convert-timezone-function-node";
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

export type DateFunctionArgumentNode =
  | ConvertTimezoneFunctionNode
  | ReferenceNode;

export interface DateFunctionNode {
  readonly kind: "DateFunctionNode";
  readonly function: DateFunction;
  readonly reference: DateFunctionArgumentNode;
}

export const DateFunctionNode = {
  create(
    dateFunction: DateFunction,
    reference: DateFunctionArgumentNode,
  ): DateFunctionNode {
    if (
      reference.kind !== "ReferenceNode" &&
      reference.kind !== "ConvertTimezoneFunctionNode"
    ) {
      throw new TypeError(
        "SOQL date functions require a field reference or an unaliased convertTimezone() expression.",
      );
    }

    return freeze({
      kind: "DateFunctionNode",
      function: dateFunction,
      reference,
    });
  },
};
