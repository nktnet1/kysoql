import { freeze } from "#src/util/object-utils";

/** Selectors accepted by Salesforce FIELDS(). */
export type FieldsSelector = "all" | "custom" | "standard";

/** Immutable query AST node for a FIELDS() selection. */
export interface FieldsFunctionNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "FieldsFunctionNode";
  /** Salesforce `FIELDS()` selector. */
  readonly selector: FieldsSelector;
}

const fieldsSelectors: readonly FieldsSelector[] = [
  "all",
  "custom",
  "standard",
];

export const FieldsFunctionNode = {
  create(selector: FieldsSelector): FieldsFunctionNode {
    if (!fieldsSelectors.includes(selector)) {
      throw new TypeError(
        "SOQL FIELDS() selector must be all, custom, or standard.",
      );
    }

    return freeze({
      kind: "FieldsFunctionNode",
      selector,
    });
  },
};
