/** Schema-generation settings; authentication stays in SF_* variables. */
export interface KysoqlConfig {
  /** API names. Omit or use [] to include all queryable objects. */
  readonly objects?: readonly string[];
  /** Output file, relative to this configuration file. */
  readonly output?: string;
  /** Name of the generated TypeScript schema interface. */
  readonly schemaName?: string;
}

/** Provide completion without reading files or contacting Salesforce. */
export const defineConfig = (config: KysoqlConfig): KysoqlConfig => config;
