import { QueryCreator } from "#src/query-creator";

/**
 * Configured query creator for building, compiling, and optionally executing
 * typed SOQL.
 */
export class Kysoql<DB> extends QueryCreator<DB> {}
