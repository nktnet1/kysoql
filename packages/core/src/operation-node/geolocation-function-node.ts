import * as v from "valibot";

import { freeze } from "#/util/object-utils";

const LATITUDE_ERROR =
  "SOQL GEOLOCATION() latitude must be a finite number between -90 and 90.";
const LONGITUDE_ERROR =
  "SOQL GEOLOCATION() longitude must be a finite number between -180 and 180.";

const latitudeSchema = v.pipe(
  v.number(LATITUDE_ERROR),
  v.finite(LATITUDE_ERROR),
  v.minValue(-90, LATITUDE_ERROR),
  v.maxValue(90, LATITUDE_ERROR),
);
const longitudeSchema = v.pipe(
  v.number(LONGITUDE_ERROR),
  v.finite(LONGITUDE_ERROR),
  v.minValue(-180, LONGITUDE_ERROR),
  v.maxValue(180, LONGITUDE_ERROR),
);

export interface GeolocationFunctionNode {
  readonly kind: "GeolocationFunctionNode";
  readonly latitude: number;
  readonly longitude: number;
}

export const GeolocationFunctionNode = {
  create(latitude: number, longitude: number): GeolocationFunctionNode {
    const parsedLatitude = v.safeParse(latitudeSchema, latitude);

    if (!parsedLatitude.success) {
      throw new TypeError(parsedLatitude.issues[0].message);
    }

    const parsedLongitude = v.safeParse(longitudeSchema, longitude);

    if (!parsedLongitude.success) {
      throw new TypeError(parsedLongitude.issues[0].message);
    }

    return freeze({
      kind: "GeolocationFunctionNode",
      latitude: parsedLatitude.output,
      longitude: parsedLongitude.output,
    });
  },
};
