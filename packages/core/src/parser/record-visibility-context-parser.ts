import * as v from "valibot";

import {
  RecordVisibilityContextNode,
  type RecordVisibilityContextNode as RecordVisibilityContextNodeType,
} from "#/operation-node/record-visibility-context-node";
import type { SelectQueryNode } from "#/operation-node/select-query-node";

interface RecordVisibilityContextShape {
  /** Maximum visibility descriptors Salesforce may evaluate per record. */
  readonly maxDescriptorPerRecord?: number;
  /** Whether Salesforce should include domain-based visibility. */
  readonly supportsDomains?: boolean;
  /** Whether Salesforce should include delegated visibility. */
  readonly supportsDelegates?: boolean;
}

/** Options for Salesforce record-visibility context clauses. */
export type RecordVisibilityContextOptions =
  | (RecordVisibilityContextShape & {
      /** Maximum visibility descriptors Salesforce may evaluate per record. */
      readonly maxDescriptorPerRecord: number;
    })
  | (RecordVisibilityContextShape & {
      /** Whether Salesforce should include domain-based visibility. */
      readonly supportsDomains: boolean;
    })
  | (RecordVisibilityContextShape & {
      /** Whether Salesforce should include delegated visibility. */
      readonly supportsDelegates: boolean;
    });

const EMPTY_CONTEXT_ERROR =
  "SOQL WITH RecordVisibilityContext requires at least one parameter.";
const UNKNOWN_PARAMETER_ERROR =
  "SOQL WITH RecordVisibilityContext supports only maxDescriptorPerRecord, supportsDomains, and supportsDelegates.";
const MAX_DESCRIPTOR_ERROR =
  "SOQL WITH RecordVisibilityContext maxDescriptorPerRecord must be a non-negative safe integer.";
const SUPPORTS_DOMAINS_ERROR =
  "SOQL WITH RecordVisibilityContext supportsDomains must be a boolean.";
const SUPPORTS_DELEGATES_ERROR =
  "SOQL WITH RecordVisibilityContext supportsDelegates must be a boolean.";
const WITH_CONFLICT_ERROR =
  "SOQL WITH RecordVisibilityContext cannot be combined with another WITH clause.";

const allowedParameters = new Set([
  "maxDescriptorPerRecord",
  "supportsDomains",
  "supportsDelegates",
]);

const maxDescriptorSchema = v.pipe(
  v.number(MAX_DESCRIPTOR_ERROR),
  v.safeInteger(MAX_DESCRIPTOR_ERROR),
  v.minValue(0, MAX_DESCRIPTOR_ERROR),
);

const validateMaxDescriptorPerRecord = (value: unknown): number => {
  const result = v.safeParse(maxDescriptorSchema, value);

  if (!result.success) {
    throw new RangeError(result.issues[0].message);
  }

  return result.output;
};

const validateBoolean = (value: unknown, error: string): boolean => {
  if (typeof value !== "boolean") {
    throw new TypeError(error);
  }

  return value;
};

const validateParameters = (
  parameters: unknown,
): RecordVisibilityContextShape => {
  if (
    typeof parameters !== "object" ||
    parameters === null ||
    Array.isArray(parameters)
  ) {
    throw new TypeError(EMPTY_CONTEXT_ERROR);
  }

  const input = parameters as Record<string, unknown>;
  const keys = Object.keys(input);

  if (keys.some((key) => !allowedParameters.has(key))) {
    throw new TypeError(UNKNOWN_PARAMETER_ERROR);
  }

  const maxDescriptorPerRecord = input.maxDescriptorPerRecord;
  const supportsDomains = input.supportsDomains;
  const supportsDelegates = input.supportsDelegates;

  if (
    maxDescriptorPerRecord === undefined &&
    supportsDomains === undefined &&
    supportsDelegates === undefined
  ) {
    throw new TypeError(EMPTY_CONTEXT_ERROR);
  }

  return {
    ...(maxDescriptorPerRecord === undefined
      ? {}
      : {
          maxDescriptorPerRecord: validateMaxDescriptorPerRecord(
            maxDescriptorPerRecord,
          ),
        }),
    ...(supportsDomains === undefined
      ? {}
      : {
          supportsDomains: validateBoolean(
            supportsDomains,
            SUPPORTS_DOMAINS_ERROR,
          ),
        }),
    ...(supportsDelegates === undefined
      ? {}
      : {
          supportsDelegates: validateBoolean(
            supportsDelegates,
            SUPPORTS_DELEGATES_ERROR,
          ),
        }),
  };
};

export const parseRecordVisibilityContext = (
  parameters: RecordVisibilityContextOptions,
): RecordVisibilityContextNodeType =>
  RecordVisibilityContextNode.create(validateParameters(parameters));

export const validateRecordVisibilityContextQuery = (
  query: SelectQueryNode,
): void => {
  if (!query.recordVisibilityContext) {
    return;
  }

  validateParameters({
    maxDescriptorPerRecord:
      query.recordVisibilityContext.maxDescriptorPerRecord,
    supportsDomains: query.recordVisibilityContext.supportsDomains,
    supportsDelegates: query.recordVisibilityContext.supportsDelegates,
  });

  if (
    query.userProfileFeedWith ||
    query.withDataCategory ||
    query.apexAccessMode
  ) {
    throw new TypeError(WITH_CONFLICT_ERROR);
  }
};
