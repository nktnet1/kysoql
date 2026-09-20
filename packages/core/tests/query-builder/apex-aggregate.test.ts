import { describe, expect, it } from "vitest";

import { apexAdd, apexBind } from "#/apex-bind";
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
      .where(
        "AnnualRevenue",
        ">=",
        apexAdd(apexBind<number>("minimumRevenue"), 1),
      )
      .where(apexBind<string>("accountType"), "includes", ["Partner"])
      .withUserMode()
      .limit(apexAdd(apexBind<number>("rowLimit"), 1))
      .offset(apexAdd(apexBind<number>("rowOffset"), 1));

    expect(query.compile().soql).toContain("SUM(AnnualRevenue)");
    expect(query.compile().soql).toContain(
      "WHERE AnnualRevenue >= :(minimumRevenue + 1) AND :accountType INCLUDES ('Partner') WITH USER_MODE LIMIT :(rowLimit + 1) OFFSET :(rowOffset + 1)",
    );
  });

  it("compiles bare COUNT() queries in the Apex context", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .apex()
      .where((eb) =>
        eb.or([
          eb("Name", "=", apexAdd("Ac", "me")),
          eb("Id", "in", apexBind<readonly string[]>("accountIds")),
          eb(apexBind<string>("accountType"), "includes", ["Partner"]),
        ]),
      )
      .withSystemMode()
      .limit(apexAdd(apexBind<number>("rowLimit"), 1));

    expect(query.compile().soql).toBe(
      "SELECT COUNT() FROM Account WHERE ((Name = :('Ac' + 'me') OR Id IN :accountIds) OR :accountType INCLUDES ('Partner')) WITH SYSTEM_MODE LIMIT :(rowLimit + 1)",
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
      aggregate.where(apexBind<string>("accountType"), "includes", ["Partner"]);
      aggregate.limit(apexAdd(apexBind<number>("rowLimit"), 1));
      aggregate.offset(apexBind<number>("rowOffset"));
      aggregate.withUserMode();
      count.where("Name", "=", apexBind<string>("accountName"));
      count.where(apexBind<string>("accountType"), "includes", ["Partner"]);
      count.limit(apexAdd(apexBind<number>("rowLimit"), 1));
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
