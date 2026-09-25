/**
 * Union of immutable query AST node shapes understood by the Kysoql
 * compiler.
 */
export interface OperationNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: string;
}
