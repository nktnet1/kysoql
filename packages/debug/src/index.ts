import {
  Kysoql,
  type SalesforceField,
  type SalesforceObject,
} from "../../core/dist/index.js";

interface DebugSchema {
  readonly Account: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Name: SalesforceField<string, "string", true, true, true, true>;
    readonly AnnualRevenue: SalesforceField<
      number,
      "currency",
      true,
      true,
      true,
      true
    >;
  }>;
}

const printQuery = (
  label: string,
  query: { toOperationNode(): unknown },
): void => {
  console.log(`\n==> ${label}`);
  console.dir(query.toOperationNode(), { depth: null });
};

const db = new Kysoql<DebugSchema>();

const accountQuery = db.selectFrom("Account");
printQuery('selectFrom("Account")', accountQuery);

const selectedQuery = accountQuery.select(["Id", "Name", "AnnualRevenue"]);
printQuery('select(["Id", "Name", "AnnualRevenue"])', selectedQuery);

const filteredQuery = selectedQuery
  .where("Name", "like", "Acme%")
  .where("AnnualRevenue", ">=", 100_000);
printQuery(
  '.where("Name", "like", "Acme%").where("AnnualRevenue", ">=", 100_000)',
  filteredQuery,
);
