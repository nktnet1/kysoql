/**
 * Utility to reduce depth of TypeScript's internal type instantiation stack.
 * Mirrors Kysely's approach so composed query output types remain manageable.
 */
export type DrainOuterGeneric<T> = [T] extends [unknown] ? T : never;

/** Flattens intersections into an object shape for result-facing type checks. */
export type Simplify<T> = DrainOuterGeneric<{ [K in keyof T]: T[K] } & {}>;
