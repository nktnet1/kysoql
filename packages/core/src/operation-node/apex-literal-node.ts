import { freeze } from "#/util/object-utils";

export type ApexLiteralValue = string | number;

export interface ApexLiteralNode {
  readonly kind: "ApexLiteralNode";
  readonly value: ApexLiteralValue;
}

export const ApexLiteralNode = {
  create(value: ApexLiteralValue): ApexLiteralNode {
    return freeze({
      kind: "ApexLiteralNode",
      value,
    });
  },
};
