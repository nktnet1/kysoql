import { parseSoqlReference } from "#/soql-identifier";
import { freeze } from "#/util/object-utils";

export interface ApexBindNode {
  readonly kind: "ApexBindNode";
  readonly name: string;
}

export const ApexBindNode = {
  create(name: string): ApexBindNode {
    return freeze({
      kind: "ApexBindNode",
      name: parseSoqlReference(name),
    });
  },
};
