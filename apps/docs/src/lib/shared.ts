import { createGetUrl } from "fumadocs-core/source";

export const appName = "Kysoql";
export const appDescription =
  "Type-safe Salesforce SOQL queries for TypeScript. Learn schema generation, query composition, native REST execution, and Apex compilation.";
export const docsRoute = "/docs";
export const repositoryUrl = "https://github.com/nktnet1/kysoql";
const repositoryBranch =
  import.meta.env.VITE_DOCS_REPOSITORY_BRANCH?.trim() || "main";

export function getPageSourceUrl(path: string): string {
  const filePath = path.split("/").map(encodeURIComponent).join("/");
  return `${repositoryUrl}/blob/${encodeURIComponent(repositoryBranch)}/apps/docs/content/docs/${filePath}`;
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
