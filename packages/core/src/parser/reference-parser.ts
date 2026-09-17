export type FieldsOf<DB, TB extends keyof DB> = DB[TB] extends {
  readonly fields: infer Fields;
}
  ? Fields
  : never;

export type FieldName<DB, TB extends keyof DB> = keyof FieldsOf<DB, TB> & string;

export type FieldDefinition<
  DB,
  TB extends keyof DB,
  Field extends FieldName<DB, TB>,
> = FieldsOf<DB, TB>[Field];
