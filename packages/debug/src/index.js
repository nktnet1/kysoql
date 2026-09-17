import { Kysoql } from "../../core/dist/index.js";

const printQuery = (label, query) => {
  console.log(`\n==> ${label}`);
  console.dir(query.toOperationNode(), {
    colors: process.stdout.isTTY,
    depth: null,
  });
};

const db = new Kysoql();

const accountQuery = db.selectFrom("Account");
printQuery('selectFrom("Account")', accountQuery);

const selectedQuery = accountQuery.select(["Id", "Name", "AnnualRevenue"]);
printQuery('select(["Id", "Name", "AnnualRevenue"])', selectedQuery);

const filteredQuery = selectedQuery
  .where("Name", "=", "Acme")
  .where("AnnualRevenue", "!=", null);
printQuery(
  'where("Name", "=", "Acme").where("AnnualRevenue", "!=", null)',
  filteredQuery,
);
