import { describe, expect, it } from "vitest";

import { apexBind } from "#/apex-bind";
import { Kysoql } from "#/kysoql";
import type { SalesforceField, SalesforceObject } from "#/schema";

type Field<
  Value = string,
  Type extends string = "string",
  Nullable extends boolean = false,
> = SalesforceField<Value, Type, Nullable, true, true, true>;

interface FixtureSchema {
  readonly Account: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly Name: Field;
    readonly AnnualRevenue: SalesforceField<
      number,
      "currency",
      true,
      true,
      true,
      true,
      never,
      never,
      never,
      true
    >;
  }>;
}

describe("Apex aggregate queries", () => {
  it("compiles aggregate-result queries in the Apex context", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.sum("AnnualRevenue").as("totalRevenue"))
      .apex()
      .where("AnnualRevenue", ">=", apexBind<number>("minimumRevenue"))
      .where(apexBind<string>("accountType"), "includes", ["Partner"])
      .withUserMode()
      .limit(apexBind<number>("rowLimit"))
      .offset(apexBind<number>("rowOffset"));

    expect(query.compile().soql).toContain("SUM(AnnualRevenue)");
    expect(query.compile().soql).toContain(
      "WHERE AnnualRevenue >= :minimumRevenue AND :accountType INCLUDES ('Partner') WITH USER_MODE LIMIT :rowLimit OFFSET :rowOffset",
    );
  });

  it("compiles bare COUNT() queries in the Apex context", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .apex()
      .where((eb) =>
        eb.or([
          eb("Name", "=", apexBind<string>("accountName")),
          eb("Id", "in", apexBind<readonly string[]>("accountIds")),
          eb(apexBind<string>("accountType"), "includes", ["Partner"]),
        ]),
      )
      .withSystemMode()
      .limit(apexBind<number>("rowLimit"));

    expect(query.compile().soql).toBe(
      "SELECT COUNT() FROM Account WHERE ((Name = :accountName OR Id IN :accountIds) OR :accountType INCLUDES ('Partner')) WITH SYSTEM_MODE LIMIT :rowLimit",
    );
  });

  it("keeps aggregate and count Apex builders compile-only and non-locking", () => {
    const typeAssertions = () => {
      const db = new Kysoql<FixtureSchema>();
      const aggregate = db
        .selectFrom("Account")
        .select(({ fn }) => fn.sum("AnnualRevenue").as("totalRevenue"))
        .apex();
      const count = db
        .selectFrom("Account")
        .select(({ fn }) => fn.count())
        .apex();

      aggregate.where("Name", "=", apexBind<string>("accountName"));
      aggregate.where(apexBind<string>("accountType"), "includes", [
        "Partner",
      ]);
      aggregate.limit(apexBind<number>("rowLimit"));
      aggregate.offset(apexBind<number>("rowOffset"));
      aggregate.withUserMode();
      count.where("Name", "=", apexBind<string>("accountName"));
      count.where(apexBind<string>("accountType"), "includes", ["Partner"]);
      count.limit(apexBind<number>("rowLimit"));
      count.withSystemMode();

      // @ts-expect-error Apex aggregate queries are compile-only.
      aggregate.execute();
      // @ts-expect-error QueryAll execution is unavailable in the Apex context.
      aggregate.executeAll();
      // @ts-expect-error FOR UPDATE is only valid for row-producing record queries.
      aggregate.forUpdate();
      // @ts-expect-error Apex bare COUNT() queries are compile-only.
      count.execute();
      // @ts-expect-error QueryAll execution is unavailable in the Apex context.
      count.executeAll();
      // @ts-expect-error FOR UPDATE is only valid for row-producing record queries.
      count.forUpdate();
      // @ts-expect-error Bare COUNT() does not support OFFSET.
      count.offset(1);
    };

    expect(typeAssertions).toBeTypeOf("function");
  });
});
