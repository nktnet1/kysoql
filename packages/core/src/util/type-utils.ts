import type { KysoqlTypeError } from "#src/util/type-error";

/**
 * Utility to reduce depth of TypeScript's internal type instantiation stack.
 * Mirrors Kysely's approach so composed query output types remain manageable.
 */
export type DrainOuterGeneric<T> = [T] extends [unknown] ? T : never;

/** Flattens intersections into an object shape for result-facing type checks. */
export type Simplify<T> = DrainOuterGeneric<{ [K in keyof T]: T[K] } & {}>;

/** Marker used by `$narrowType()` to remove null from a selected field. */
export type NotNull = {
  /** Type-only marker consumed by `$narrowType()`; it has no runtime meaning. */
  readonly __notNull__: unique symbol;
};

/** Narrows selected output properties without changing the generated SOQL. */
export type NarrowPartial<O, T> = T extends object
  ? DrainOuterGeneric<{
      [K in keyof O & string]: K extends keyof T
        ? T[K] extends NotNull
          ? Exclude<O[K], null>
          : T[K] extends O[K]
            ? T[K]
            : T[K] extends object
              ? SimplifyDeep<O[K] & NarrowPartial<O[K], T[K]>>
              : KysoqlTypeError<`$narrowType() call failed: passed type does not exist in '${K}'s type union`>
        : O[K];
    }>
  : never;

/** Recursively simplifies nested output types after narrowing. */
export type SimplifyDeep<T> = T extends object
  ? T extends Date | RegExp
    ? T
    : T extends Map<infer _Key, infer _Value>
      ? T
      : T extends Set<infer _Value>
        ? T
        : DrainOuterGeneric<{ [K in keyof T]: SimplifyDeep<T[K]> } & {}>
  : T;

/** Makes fields introduced by a runtime-conditional builder callback optional. */
export type ConditionalOutput<Base, Added> = Base &
  Partial<Omit<Added, keyof Base>>;

/** Extracts concrete string keys while treating Record<string, never> as empty. */
export type NonNeverStringKey<T> = {
  [Key in keyof T]: [T[Key]] extends [never] ? never : Key;
}[keyof T] &
  string;
