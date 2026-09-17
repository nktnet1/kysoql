import {
  Kysoql,
  soqlDate,
  soqlDateTime,
  soqlTime,
  type CompiledQuery,
  type QueryExecutor,
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
    readonly Occurred_On__c: SalesforceField<
      string,
      "date",
      true,
      true,
      true,
      true
    >;
    readonly LastActivityAt__c: SalesforceField<
      string,
      "datetime",
      true,
      true,
      true,
      true
    >;
    readonly OpeningTime__c: SalesforceField<
      string,
      "time",
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

const executor: QueryExecutor = {
  async executeQuery<O>(
    compiledQuery: CompiledQuery<O>,
  ): Promise<readonly O[]> {
    console.log("\n==> executor.executeQuery()");
    console.log(compiledQuery.soql);
    return [];
  },
};

const db = new Kysoql<DebugSchema>({ executor });

const accountQuery = db.selectFrom("Account");
printQuery('selectFrom("Account")', accountQuery);

const selectedQuery = accountQuery.select(["Id", "Name", "AnnualRevenue"]);
printQuery('select(["Id", "Name", "AnnualRevenue"])', selectedQuery);

const filteredQuery = selectedQuery
  .where("Name", "like", "Acme%")
  .where("AnnualRevenue", ">=", 100_000)
  .where("Occurred_On__c", ">=", soqlDate("2026-01-01"))
  .where(
    "LastActivityAt__c",
    "<",
    soqlDateTime("2027-01-01T00:00:00Z"),
  )
  .where("OpeningTime__c", ">=", soqlTime("09:00:00.000Z"));
printQuery("chained scalar + temporal where() calls", filteredQuery);

const orderedQuery = filteredQuery
  .orderBy("AnnualRevenue", "desc")
  .orderBy("Name", "asc");
printQuery("chained orderBy() calls", orderedQuery);

const limitedQuery = orderedQuery.limit(25);
printQuery("limit(25)", limitedQuery);

console.log("\n==> compile()");
console.log(limitedQuery.compile().soql);

console.log("\n==> execute()");
console.log(await limitedQuery.execute());
