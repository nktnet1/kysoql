/**
 * Compile-time error marker used by fluent helpers that intentionally return an
 * unusable type when a type assertion cannot be proven.
 */
export interface KysoqlTypeError<Message extends string> {
  readonly __kysoqlTypeError__: Message;
}
