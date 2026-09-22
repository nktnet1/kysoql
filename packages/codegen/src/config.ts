/** Exact field API names; include and exclude are mutually exclusive. */
export type ObjectFieldFilter =
  | {
      readonly include: readonly string[];
      readonly exclude?: never;
    }
  | {
      readonly include?: never;
      readonly exclude: readonly string[];
    };

/** Rules do not add objects to the generation set. */
export type ObjectFieldFilters = Readonly<Record<string, ObjectFieldFilter>>;

/** Schema-generation settings; authentication stays in SF_* variables. */
export interface KysoqlConfig {
  /** Salesforce REST API version, without v. Applies to CLI generation only. */
  readonly apiVersion?: string;
  /** API names. Omit or use [] to include all queryable objects. */
  readonly objects?: readonly string[];
  /** Per-object field rules. Omitted objects retain all described fields. */
  readonly fields?: ObjectFieldFilters;
  /** Output file, relative to this configuration file. */
  readonly output?: string;
  /** Name of the generated TypeScript schema interface. */
  readonly schemaName?: string;
}

/** Provide completion without reading files or contacting Salesforce. */
export const defineConfig = (config: KysoqlConfig): KysoqlConfig => config;
