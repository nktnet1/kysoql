import type { RawNode } from "#src/operation-node/raw-node";
import { RawNode as RawNodeFactory } from "#src/operation-node/raw-node";
import { type SoqlLikeLiteral, soqlLikeLiteral } from "#src/soql-like-literal";
import { freeze } from "#src/util/object-utils";

declare const soqlRawBuilderType: unique symbol;

/**
 * A trusted SOQL fragment that is emitted verbatim by the compiler.
 *
 * Raw fragments bypass Kysoql's identifier and value escaping. Never build one
 * from untrusted or user-controlled input.
 */
export interface SoqlRawBuilder<Output = unknown> {
  /** Type-only brand used by Kysoql to preserve compile-time information; it has no user-facing runtime meaning. */
  readonly [soqlRawBuilderType]: Output;

  /** Returns the immutable operation node represented by this builder. */
  toOperationNode(): RawNode;
}

class SoqlRawBuilderImpl<Output> implements SoqlRawBuilder<Output> {
  declare readonly [soqlRawBuilderType]: Output;

  readonly #node: RawNode;

  constructor(fragment: string) {
    this.#node = RawNodeFactory.create(fragment);
    Object.freeze(this);
  }

  toOperationNode(): RawNode {
    return this.#node;
  }
}

export function isSoqlRawBuilder(value: unknown): value is SoqlRawBuilder {
  return value instanceof SoqlRawBuilderImpl;
}

function raw<Output = unknown>(fragment: string): SoqlRawBuilder<Output> {
  return new SoqlRawBuilderImpl<Output>(fragment);
}

/**
 * SOQL literal helpers, including the explicit unsafe raw-fragment escape
 * hatch.
 */
export const soql = freeze({
  /**
   * Emit trusted SOQL verbatim. Do not pass user-controlled input.
   */
  raw,

  /**
   * Treat `%` and `_` literally inside a LIKE value.
   *
   * Plain string LIKE values keep Salesforce wildcard semantics.
   */
  likeLiteral: soqlLikeLiteral,
});

export type { SoqlLikeLiteral };
