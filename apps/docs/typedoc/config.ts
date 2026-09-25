import path from "node:path";
import type { TypeDocOptions } from "typedoc";
import type { PluginOptions as MarkdownPluginOptions } from "typedoc-plugin-markdown";

const ROOT_PATH = path.resolve(import.meta.dirname, "../../..");

interface FrontmatterPluginOptions {
  readonly frontmatterGlobals: Readonly<Record<string, unknown>>;
  readonly yamlStringifyOptions: Readonly<Record<string, unknown>>;
}

export interface PackageTypeDocConfig {
  readonly packageName: "auth" | "codegen" | "core" | "jsforce" | "rest";
  readonly outputDirectory: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
}

export function createPackageTypeDocConfig({
  packageName,
  outputDirectory,
  title,
  description,
  icon,
}: PackageTypeDocConfig): TypeDocOptions &
  MarkdownPluginOptions &
  FrontmatterPluginOptions {
  return {
    plugin: ["typedoc-plugin-markdown", "typedoc-plugin-frontmatter"],
    entryPoints: [path.join(ROOT_PATH, `packages/${packageName}/src/index.ts`)],
    tsconfig: path.join(ROOT_PATH, `packages/${packageName}/tsconfig.json`),
    compilerOptions: {
      customConditions: ["development"],
      // Package-local `#/*` imports must be resolved through each package's
      // `package.json#imports`. Inheriting the entry package's `paths` mapping
      // would incorrectly apply it to source pulled in from workspace packages.
      paths: {},
    },

    validation: {
      // Public signatures intentionally reference implementation-only helper
      // types. They should remain visible in signatures without becoming API
      // documentation entries of their own.
      notExported: false,
    },

    out: path.join(ROOT_PATH, "apps/docs/content/docs", outputDirectory),
    entryFileName: "api",
    fileExtension: ".mdx",
    cleanOutputDir: false,
    readme: "none",
    router: "module",

    hidePageHeader: true,
    hidePageTitle: true,
    useCodeBlocks: true,
    expandObjects: false,
    // Keep TypeDoc's symbol links independent from the heading slugger used by
    // Fumadocs/remark. The prefix avoids duplicate IDs on normal headings.
    useHTMLAnchors: true,
    anchorPrefix: "api-",

    enumMembersFormat: "table",
    indexFormat: "table",
    interfacePropertiesFormat: "table",
    parametersFormat: "table",
    typeDeclarationFormat: "table",
    classPropertiesFormat: "table",
    propertyMembersFormat: "table",
    typeAliasPropertiesFormat: "table",

    disableSources: true,
    jsDocCompatibility: true,
    sort: ["kind"],

    frontmatterGlobals: {
      title,
      description,
      icon,
      generated: true,
    },
    yamlStringifyOptions: {
      defaultKeyType: "PLAIN",
      defaultStringType: "QUOTE_DOUBLE",
      lineWidth: 0,
    },
  };
}
