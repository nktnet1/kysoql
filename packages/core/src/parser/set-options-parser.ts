import * as v from "valibot";

import {
  type ApexBindExpression,
  type ApexDatabaseQueryOptions,
  isApexBindExpression,
} from "#src/apex-bind";
import type { SelectQueryNode } from "#src/operation-node/select-query-node";
import {
  SetOptionsNode,
  type SetOptionsNode as SetOptionsNodeType,
} from "#src/operation-node/set-options-node";
import type {
  SalesforceObjectSetOptionsCapability,
  SalesforceSetOptionsCapability,
} from "#src/schema";

/** SET OPTIONS supported by Salesforce Data 360 data lake objects. */
export interface Data360DloSetOptions {
  /** Data 360 dataspace to query. */
  readonly dataspace: string;
  /** Whether the query preserves empty strings instead of treating them as null. */
  readonly honorEmptyStrings?: boolean;
}

/** SET OPTIONS supported by Salesforce Data 360 data model objects. */
export interface Data360DmoSetOptions {
  /** Whether the query preserves empty strings instead of treating them as null. */
  readonly honorEmptyStrings: boolean;
}

/** SET OPTIONS shape selected from a Salesforce object capability. */
export type Data360SetOptionsFor<ObjectType> =
  SalesforceObjectSetOptionsCapability<ObjectType> extends "data360-dlo"
    ? Data360DloSetOptions
    : SalesforceObjectSetOptionsCapability<ObjectType> extends "data360-dmo"
      ? Data360DmoSetOptions
      : never;

/**
 * Aggregate-query SET OPTIONS shape selected from a Salesforce object
 * capability.
 */
export type Data360AggregateSetOptionsFor<ObjectType> =
  SalesforceObjectSetOptionsCapability<ObjectType> extends "data360-dlo"
    ? Data360DloSetOptions
    : never;

const DATASPACE_ERROR =
  "SOQL SET OPTIONS dataspace must be a non-empty string.";
const HONOR_EMPTY_STRINGS_ERROR =
  "SOQL SET OPTIONS honorEmptyStrings must be a boolean.";
const KEYS_ERROR =
  "SOQL SET OPTIONS supports only dataspace and honorEmptyStrings for Data 360 queries.";
const EMPTY_ERROR = "SOQL SET OPTIONS requires at least one option.";
const DLO_DATASPACE_ERROR =
  "SOQL Data 360 DLO queries using SET OPTIONS require dataspace.";
const DMO_DATASPACE_ERROR =
  "SOQL SET OPTIONS dataspace is valid only for Data 360 DLO queries.";
const PLATFORM_ERROR =
  "SOQL literal SET OPTIONS is valid only for Data 360 DLO or DMO queries.";
const DMO_SIMPLE_QUERY_ERROR =
  "SOQL SET OPTIONS honorEmptyStrings on Data 360 DMOs supports only simple non-aggregate queries.";
const DYNAMIC_APEX_OPTIONS_ERROR =
  "Dynamic Apex SET OPTIONS requires a Database.QueryOptions bind variable.";
const STATIC_APEX_OPTIONS_ERROR =
  "Bound SOQL SET OPTIONS is valid only in the dynamic Apex query context.";

const dataspaceSchema = v.pipe(
  v.string(DATASPACE_ERROR),
  v.minLength(1, DATASPACE_ERROR),
);

const validateOptions = (
  options: unknown,
): {
  readonly dataspace?: string;
  readonly honorEmptyStrings?: boolean;
} => {
  if (
    typeof options !== "object" ||
    options === null ||
    Array.isArray(options)
  ) {
    throw new TypeError(KEYS_ERROR);
  }

  const input = options as Record<string, unknown>;
  const keys = Object.keys(input);

  if (keys.length === 0) {
    throw new TypeError(EMPTY_ERROR);
  }

  if (keys.some((key) => key !== "dataspace" && key !== "honorEmptyStrings")) {
    throw new TypeError(KEYS_ERROR);
  }

  const result: {
    dataspace?: string;
    honorEmptyStrings?: boolean;
  } = {};

  if ("dataspace" in input) {
    const parsed = v.safeParse(dataspaceSchema, input.dataspace);
    if (!parsed.success) {
      throw new TypeError(DATASPACE_ERROR);
    }
    result.dataspace = parsed.output;
  }

  if ("honorEmptyStrings" in input) {
    if (typeof input.honorEmptyStrings !== "boolean") {
      throw new TypeError(HONOR_EMPTY_STRINGS_ERROR);
    }
    result.honorEmptyStrings = input.honorEmptyStrings;
  }

  return result;
};

export const parseSetOptions = (
  options: Data360DloSetOptions | Data360DmoSetOptions,
): SetOptionsNodeType => SetOptionsNode.create(validateOptions(options));

export const parseDynamicApexSetOptions = (
  options: ApexBindExpression<ApexDatabaseQueryOptions>,
): SetOptionsNodeType => {
  if (!isApexBindExpression(options)) {
    throw new TypeError(DYNAMIC_APEX_OPTIONS_ERROR);
  }

  const node = options.toOperationNode();
  if (node.kind !== "ApexBindNode" || node.name.includes(".")) {
    throw new TypeError(DYNAMIC_APEX_OPTIONS_ERROR);
  }

  return SetOptionsNode.createApexQueryOptions(node);
};

const capabilityFromObjectName = (
  objectName: string,
): SalesforceSetOptionsCapability => {
  const lowerName = objectName.toLowerCase();
  if (lowerName.endsWith("__dll")) {
    return "data360-dlo";
  }
  if (lowerName.endsWith("__dlm")) {
    return "data360-dmo";
  }
  return "none";
};

const containsAggregateFunction = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some(containsAggregateFunction);
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  const node = value as Record<string, unknown>;
  if (node.kind === "AggregateFunctionNode") {
    return true;
  }

  if (node.kind === "ValueNode" || node.kind === "ApexLiteralNode") {
    return false;
  }

  return Object.values(node).some(containsAggregateFunction);
};

const hasAggregateSelection = (query: SelectQueryNode): boolean =>
  query.selections?.some(({ selection }) =>
    containsAggregateFunction(selection),
  ) === true;

export const validateSetOptionsQuery = (
  query: SelectQueryNode,
  dynamicApex = false,
): void => {
  const options = query.setOptions;
  if (!options) {
    return;
  }

  if (options.apexQueryOptions) {
    if (!dynamicApex) {
      throw new TypeError(STATIC_APEX_OPTIONS_ERROR);
    }
    if (
      options.apexQueryOptions.name.includes(".") ||
      options.dataspace !== undefined ||
      options.honorEmptyStrings !== undefined
    ) {
      throw new TypeError(DYNAMIC_APEX_OPTIONS_ERROR);
    }
    return;
  }

  const validatedOptions = validateOptions({
    ...(options.dataspace === undefined
      ? {}
      : { dataspace: options.dataspace.value }),
    ...(options.honorEmptyStrings === undefined
      ? {}
      : { honorEmptyStrings: options.honorEmptyStrings }),
  });
  const capability = capabilityFromObjectName(query.from.name);

  if (capability === "none") {
    throw new TypeError(PLATFORM_ERROR);
  }

  if (capability === "data360-dlo") {
    if (validatedOptions.dataspace === undefined) {
      throw new TypeError(DLO_DATASPACE_ERROR);
    }
    return;
  }

  if (validatedOptions.dataspace !== undefined) {
    throw new TypeError(DMO_DATASPACE_ERROR);
  }

  if (validatedOptions.honorEmptyStrings === undefined) {
    throw new TypeError(HONOR_EMPTY_STRINGS_ERROR);
  }

  if (query.groupBy || query.having || hasAggregateSelection(query)) {
    throw new TypeError(DMO_SIMPLE_QUERY_ERROR);
  }
};
