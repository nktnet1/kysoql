import type { TypeDocOptions } from "typedoc";
import type { PluginOptions as MarkdownPluginOptions } from "typedoc-plugin-markdown";
import { load as typedocPluginMarkdown } from "typedoc-plugin-markdown";
import { removeLeadingReturnUnionPipe } from "#/plugins/removeLeadingReturnUnionPipe";
import { removeTrailingWhitespace } from "#/plugins/removeTrailingWhitespace";
import { wrapMarkdown } from "#/plugins/wrapMarkdown";

export interface TypeDocConfigOptions {
  readonly entryPoint: string;
  readonly outputPath: string;
  readonly tsconfigPath: string;
  readonly frontmatterPath: string;
}

export function createTypeDocConfig({
  entryPoint,
  outputPath,
  tsconfigPath,
  frontmatterPath,
}: TypeDocConfigOptions): TypeDocOptions & MarkdownPluginOptions {
  return {
    plugin: [
      typedocPluginMarkdown,
      removeLeadingReturnUnionPipe,
      removeTrailingWhitespace,
      wrapMarkdown({
        before: [frontmatterPath],
        after: [],
      }),
    ],
    entryPoints: [entryPoint],
    tsconfig: tsconfigPath,
    compilerOptions: {
      customConditions: ["development"],
      paths: {},
    },
    validation: {
      notExported: false,
    },
    gitRevision: "main",
    hidePageHeader: true,

    out: outputPath,
    entryFileName: "api",
    fileExtension: ".mdx",
    cleanOutputDir: false,
    readme: "none",

    typePrintWidth: 180,
    enumMembersFormat: "table",
    indexFormat: "table",
    interfacePropertiesFormat: "table",
    parametersFormat: "table",
    typeDeclarationFormat: "table",
    classPropertiesFormat: "table",
    propertyMembersFormat: "table",
    typeAliasPropertiesFormat: "table",
    hidePageTitle: true,
    useCodeBlocks: true,
    sanitizeComments: true,
    useHTMLAnchors: true,
    anchorPrefix: "api-",

    categorizeByGroup: true,
    router: "module",
    expandObjects: false,
    disableSources: true,
    jsDocCompatibility: true,

    sort: ["kind"],
    groupOrder: ["Functions", "Types", "*"],
  };
}
