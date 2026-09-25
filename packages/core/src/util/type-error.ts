/**
 * Compile-time error marker used by fluent helpers that intentionally return an
 * unusable type when a type assertion cannot be proven.
 */
export interface KysoqlTypeError<Message extends string> {
  /** Type-only brand used by Kysoql to preserve compile-time information; it has no user-facing runtime meaning. */
  readonly __kysoqlTypeError__: Message;
}
