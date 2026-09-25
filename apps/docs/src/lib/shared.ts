import { createGetUrl } from "fumadocs-core/source";

export const appName = "Kysoql";
export const appDescription =
  "A Kysely-inspired, type-safe query builder for Salesforce SOQL in TypeScript, with schema generation, native REST execution, and Apex compilation.";
export const docsRoute = "/docs";
export const repositoryUrl = "https://github.com/nktnet1/kysoql";
const repositoryBranch =
  import.meta.env.VITE_DOCS_REPOSITORY_BRANCH?.trim() || "main";

const generatedApiSources = [
  ["auth/api/", "packages/auth/src/index.ts"],
  ["codegen/api/", "packages/codegen/src/index.ts"],
  ["core/reference/api/", "packages/core/src/index.ts"],
  ["jsforce/api/", "packages/jsforce/src/index.ts"],
  ["rest/api/", "packages/rest/src/index.ts"],
] as const;

export function getPageSourceUrl(path: string): string {
  const generatedSource = generatedApiSources.find(([prefix]) =>
    path.startsWith(prefix),
  )?.[1];
  const sourcePath = generatedSource ?? `apps/docs/content/docs/${path}`;
  const filePath = sourcePath.split("/").map(encodeURIComponent).join("/");
  return `${repositoryUrl}/blob/${encodeURIComponent(repositoryBranch)}/${filePath}`;
}

const getDocsUrl = createGetUrl(docsRoute);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs];
  if (segments.length === 0) {
    segments.push("index.md");
  } else {
    segments[segments.length - 1] += ".md";
  }

  return { segments, url: getDocsUrl(segments, page.locale) };
}

/** @returns page slugs */
export function decodeMarkdownUrl(segments: string[]) {
  if (segments.length === 0) {
    return [];
  }
  const out = [...segments];
  out[out.length - 1] = out[out.length - 1].replace(/\.md$/, "");
  if (out.length === 1 && out[0] === "index") {
    out.pop();
  }
  return out;
}
