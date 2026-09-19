import { describe, expect, expectTypeOf, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type { SelectQueryBuilder } from "#/query-builder/select-query-builder";
import type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceGeolocation,
  SalesforceObject,
  SalesforceParentRelationship,
} from "#/schema";
import type { Simplify } from "#/util/type-utils";

type LocationField<
  Nullable extends boolean,
  Filterable extends boolean = true,
  Sortable extends boolean = true,
> = SalesforceField<
  SalesforceGeolocation,
  "location",
  Nullable,
  Filterable,
  Sortable,
  true,
  never,
  never,
  never,
  true,
  true
>;

interface GeolocationSchema {
  readonly Account: SalesforceObject<
    {
      readonly Id: SalesforceField<
        string,
        "id",
        false,
        true,
        true,
        true,
        never,
        never,
        never,
        true
      >;
      readonly Name: SalesforceField<string, "string", true, true, true, true>;
      readonly Office__c: LocationField<false>;
      readonly Backup_Office__c: LocationField<true>;
      readonly Hidden_Office__c: LocationField<false, false, false>;
      readonly OwnerId: SalesforceField<
        string,
        "reference",
        true,
        true,
        true,
        true,
        "User",
        "Owner"
      >;
    },
    {
      readonly Owner: SalesforceParentRelationship<"User", "OwnerId", true>;
    },
    {
      readonly Contacts: SalesforceChildRelationship<"Contact", "AccountId">;
    }
  >;
  readonly User: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Home__c: LocationField<false>;
  }>;
  readonly Contact: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly AccountId: SalesforceField<
      string,
      "reference",
      false,
      true,
      true,
      true,
      "Account"
    >;
    readonly Mailing_Location__c: LocationField<true>;
  }>;
}

type OutputOf<Query> =
  Query extends SelectQueryBuilder<infer _DB, infer _TB, infer Output>
    ? Output
    : never;

describe("typed geolocation expressions", () => {
  it("selects typed location values and aliased distance outputs", () => {
    const query = new Kysoql<GeolocationSchema>()
      .selectFrom("Account")
      .select(["Id", "Office__c"])
      .select(({ fn }) => [
        fn
          .distance("Office__c", fn.geolocation(-33.8688, 151.2093), "km")
          .as("distanceFromSydney"),
        fn.distance("Office__c", "Backup_Office__c", "mi").as("backupDistance"),
        fn
          .distance("Owner.Home__c", fn.geolocation(-37.8136, 144.9631), "km")
          .as("ownerDistanceFromMelbourne"),
      ]);

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Office__c: SalesforceGeolocation;
      readonly distanceFromSydney: number;
      readonly backupDistance: number | null;
      readonly ownerDistanceFromMelbourne: number | null;
    }>();
  });

  it("builds immutable distance filters and ordering", () => {
    const base = new Kysoql<GeolocationSchema>()
      .selectFrom("Account")
      .select("Id");
    const filtered = base.where((eb) =>
      eb(
        eb.fn.distance(
          "Office__c",
          eb.fn.geolocation(-33.8688, 151.2093),
          "km",
        ),
        "<",
        25,
      ),
    );
    const ordered = filtered.orderBy(
      ({ fn }) =>
        fn.distance("Office__c", fn.geolocation(-33.8688, 151.2093), "km"),
      "asc",
      "last",
    );

    expect(base.toOperationNode().where).toBeUndefined();
    expect(filtered.toOperationNode().orderBy).toBeUndefined();
    expect(ordered.toOperationNode().where?.where.kind).toBe(
      "BinaryOperationNode",
    );
    expect(ordered.toOperationNode().orderBy?.items[0]?.orderBy.kind).toBe(
      "DistanceFunctionNode",
    );
    expect(Object.isFrozen(ordered.toOperationNode())).toBe(true);
    expect(Object.isFrozen(ordered.toOperationNode().orderBy?.items)).toBe(
      true,
    );
  });

  it("supports geolocation expressions inside relationship subqueries", () => {
    const query = new Kysoql<GeolocationSchema>()
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts
          .select("Id")
          .select(({ fn }) =>
            fn
              .distance(
                "Mailing_Location__c",
                fn.geolocation(-33.8688, 151.2093),
                "km",
              )
              .as("distanceFromSydney"),
          )
          .where((eb) =>
            eb(
              eb.fn.distance(
                "Mailing_Location__c",
                eb.fn.geolocation(-33.8688, 151.2093),
                "km",
              ),
              "<",
              50,
            ),
          )
          .orderBy(({ fn }) =>
            fn.distance(
              "Mailing_Location__c",
              fn.geolocation(-33.8688, 151.2093),
              "km",
            ),
          ),
      );

    expect(query.toOperationNode().selections?.[1]?.selection.kind).toBe(
      "RelationshipSubqueryNode",
    );
  });

  it("keeps unsupported scalar and grouping operations out of the type surface", () => {
    const query = new Kysoql<GeolocationSchema>().selectFrom("Account");

    const grouped = query.select(({ fn }) => fn.count("Id").as("count"));

    const invalidCalls = () => {
      // @ts-expect-error Location fields cannot be used in GROUP BY.
      grouped.groupBy("Office__c");
      // @ts-expect-error Location fields must be compared through DISTANCE().
      query.where("Office__c", "=", { latitude: 0, longitude: 0 });
      // @ts-expect-error Location fields are ordered through DISTANCE().
      query.orderBy("Office__c");
      // @ts-expect-error Location fields cannot be grouped directly.
      query.select(({ fn }) => fn.max("Office__c").as("maximumLocation"));
      query.select(({ fn }) => {
        // @ts-expect-error DISTANCE requires a location field as its first argument.
        return fn.distance("Name", fn.geolocation(0, 0), "km").as("bad");
      });
      query.select(({ fn }) => {
        // @ts-expect-error GEOLOCATION() cannot be used as the first DISTANCE() argument.
        return fn.distance(fn.geolocation(0, 0), "Office__c", "km").as("bad");
      });
      query.select(({ fn }) => {
        // @ts-expect-error DISTANCE only accepts mi or km.
        return fn.distance("Office__c", fn.geolocation(0, 0), "m").as("bad");
      });
      // @ts-expect-error GEOLOCATION() is only valid as a DISTANCE() argument.
      query.select(({ fn }) => fn.geolocation(0, 0));
      // @ts-expect-error DISTANCE SELECT expressions require deterministic aliases.
      query.select(({ fn }) => {
        return fn.distance("Office__c", fn.geolocation(0, 0), "km");
      });
      query.where((eb) =>
        // @ts-expect-error DISTANCE filters only support < and >.
        eb(eb.fn.distance("Office__c", eb.fn.geolocation(0, 0), "km"), "<=", 5),
      );
      query.where((eb) => {
        const distance = eb.fn.distance(
          "Office__c",
          eb.fn.geolocation(0, 0),
          "km",
        );
        // @ts-expect-error DISTANCE filter distances must be numeric.
        return eb(distance, "<", "5");
      });
      query.where((eb) =>
        eb(
          eb.fn.distance(
            // @ts-expect-error Non-filterable location fields cannot be used in DISTANCE filters.
            "Hidden_Office__c",
            eb.fn.geolocation(0, 0),
            "km",
          ),
          "<",
          5,
        ),
      );
      // @ts-expect-error Non-sortable location fields cannot be used in DISTANCE ordering.
      query.orderBy(({ fn }) =>
        fn.distance("Hidden_Office__c", fn.geolocation(0, 0), "km"),
      );
    };

    expect(invalidCalls).toBeTypeOf("function");
  });

  it("validates coordinates, units, filter operators, and filter values at runtime", () => {
    const query = new Kysoql<GeolocationSchema>()
      .selectFrom("Account")
      .select("Id");

    expect(() =>
      query.select(({ fn }) =>
        fn.distance("Office__c", fn.geolocation(91, 0), "km").as("distance"),
      ),
    ).toThrow(
      "SOQL GEOLOCATION() latitude must be a finite number between -90 and 90.",
    );
    expect(() =>
      query.select(({ fn }) =>
        fn.distance("Office__c", fn.geolocation(0, 181), "km").as("distance"),
      ),
    ).toThrow(
      "SOQL GEOLOCATION() longitude must be a finite number between -180 and 180.",
    );
    expect(() =>
      query.select(({ fn }) =>
        fn
          .distance(fn.geolocation(0, 0) as never, "Office__c", "km")
          .as("distance"),
      ),
    ).toThrow(
      "SOQL DISTANCE() requires a location field reference as its first argument.",
    );
    expect(() =>
      query.select(({ fn }) =>
        fn
          .distance("Office__c", fn.geolocation(0, 0), "yards" as never)
          .as("distance"),
      ),
    ).toThrow("SOQL DISTANCE() unit must be 'mi' or 'km'.");
    expect(() =>
      query.where((eb) =>
        eb(
          eb.fn.distance("Office__c", eb.fn.geolocation(0, 0), "km"),
          "=" as never,
          5,
        ),
      ),
    ).toThrow("SOQL DISTANCE() filters only support < or > comparisons.");
    expect(() =>
      query.where((eb) =>
        eb(
          eb.fn.distance("Office__c", eb.fn.geolocation(0, 0), "km"),
          "<",
          Number.POSITIVE_INFINITY,
        ),
      ),
    ).toThrow("SOQL DISTANCE() filters require a finite numeric distance.");
  });
});
