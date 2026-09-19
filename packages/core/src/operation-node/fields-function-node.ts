import { freeze } from "#/util/object-utils";

export type FieldsSelector = "all" | "custom" | "standard";

export interface FieldsFunctionNode {
  readonly kind: "FieldsFunctionNode";
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
