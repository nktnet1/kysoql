import { describe, expect, it } from "vitest";

import { Kysoql } from "#src/kysoql";
import type {
  SalesforceField,
  SalesforceGeolocation,
  SalesforceObject,
  SalesforceParentRelationship,
} from "#src/schema";

type LocationField<Nullable extends boolean> = SalesforceField<
  SalesforceGeolocation,
  "location",
  Nullable,
  true,
  true,
  false,
  never,
  never,
  never,
  false,
  true
>;

interface GeolocationSchema {
  readonly Account: SalesforceObject<
    {
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
      readonly Office__c: LocationField<false>;
      readonly Backup_Office__c: LocationField<true>;
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
    }
  >;
  readonly User: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Home__c: LocationField<false>;
  }>;
}

describe("geolocation compiler", () => {
  it("compiles GEOLOCATION and DISTANCE in SELECT, WHERE, and ORDER BY", () => {
    const compiled = new Kysoql<GeolocationSchema>()
      .selectFrom("Account")
      .select("Id")
      .select(({ fn }) => [
        fn
          .distance("Office__c", fn.geolocation(-33.8688, 151.2093), "km")
          .as("distanceFromSydney"),
        fn.distance("Office__c", "Backup_Office__c", "mi").as("backupDistance"),
      ])
      .where((eb) =>
        eb(
          eb.fn.distance(
            "Owner.Home__c",
            eb.fn.geolocation(-37.8136, 144.9631),
            "km",
          ),
          ">",
          10,
        ),
      )
      .orderBy(
        ({ fn }) =>
          fn.distance("Office__c", fn.geolocation(-33.8688, 151.2093), "km"),
        "desc",
        "last",
      )
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id, DISTANCE(Office__c, GEOLOCATION(-33.8688, 151.2093), 'km') distanceFromSydney, DISTANCE(Office__c, Backup_Office__c, 'mi') backupDistance FROM Account WHERE DISTANCE(Owner.Home__c, GEOLOCATION(-37.8136, 144.9631), 'km') > 10 ORDER BY DISTANCE(Office__c, GEOLOCATION(-33.8688, 151.2093), 'km') DESC NULLS LAST",
    );
  });
});
