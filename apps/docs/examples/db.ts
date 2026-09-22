/** Compile/typecheck fixture only. This client intentionally has no executor. */
import { Kysoql } from "@kysoql/core";
import type { SalesforceSchema } from "./salesforce.generated";

export const db = new Kysoql<SalesforceSchema>();
