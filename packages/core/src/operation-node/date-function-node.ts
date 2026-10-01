import type { ConvertTimezoneFunctionNode } from "#src/operation-node/convert-timezone-function-node";
import type { ReferenceNode } from "#src/operation-node/reference-node";
import { freeze } from "#src/util/object-utils";

/** Salesforce date and fiscal date function names supported by Kysoql. */
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

/** Immutable query AST node for a Salesforce date-function argument. */
export type DateFunctionArgumentNode =
  | ConvertTimezoneFunctionNode
  | ReferenceNode;

/**
 * Immutable query AST node for a Salesforce date or fiscal date function.
 */
export interface DateFunctionNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "DateFunctionNode";
  /** Salesforce function represented by this node. */
  readonly function: DateFunction;
  /** Field or relationship reference passed to the expression. */
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
