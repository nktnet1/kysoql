export interface GenerateSchemaOptions {
  readonly output: string;
}

export const generateSchema = async (_options: GenerateSchemaOptions): Promise<void> => {
  throw new Error("Schema generation is not implemented yet.");
};
