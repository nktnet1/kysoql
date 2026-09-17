import { SelectQueryNode } from "./operation-node/select-query-node.js";
import { SObjectNode } from "./operation-node/sobject-node.js";
import {
  createSelectQueryBuilder,
  type SelectQueryBuilder,
} from "./query-builder/select-query-builder.js";

export class QueryCreator<DB> {
  selectFrom<TB extends keyof DB & string>(
    from: TB,
  ): SelectQueryBuilder<DB, TB, Record<never, never>> {
    return createSelectQueryBuilder({
      queryNode: SelectQueryNode.createFrom(SObjectNode.create(from)),
    });
  }
}
