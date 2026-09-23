import type { SalesforceOAuthSession } from "@kysoql/auth";

/** Resolve a fresh Salesforce OAuth session for CLI schema generation. */
export type SalesforceAuthProvider = () =>
  | SalesforceOAuthSession
  | Promise<SalesforceOAuthSession>;

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

/** Schema-generation settings. Authentication is resolved explicitly. */
export interface KysoqlConfig {
  /** Obtain the Salesforce session used by the CLI. */
  readonly auth?: SalesforceAuthProvider;
  /** Salesforce REST API version, without v. Applies to CLI generation only. */
  readonly apiVersion?: string;
  /** API names. Omit or use [] to include all queryable objects. */
  readonly objects?: readonly string[];
  /** Per-object field rules. Omitted objects retain all described fields. */
  readonly fields?: ObjectFieldFilters;
  /** Override the generated file; relative paths resolve from this config file. */
  readonly output?: string;
  /** Name of the generated TypeScript schema interface. */
  readonly schemaName?: string;
}

/** Provide completion without reading files or contacting Salesforce. */
export const defineConfig = (config: KysoqlConfig): KysoqlConfig => config;
