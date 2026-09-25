import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Application } from "typedoc";
import type { MarkdownApplication } from "typedoc-plugin-markdown";

interface WrapMarkdownOptions {
  before?: string[];
  after?: string[];
}

export function wrapMarkdown(options: WrapMarkdownOptions) {
  return (app: Application): void => {
    const markdownApp = app as MarkdownApplication;

    const read = (files: string[] = []) =>
      files
        .map((file) => readFileSync(resolve(file), "utf8").trim())
        .filter(Boolean)
        .join("\n\n");

    markdownApp.renderer.markdownHooks.on("index.page.begin", () =>
      read(options.before),
    );

    markdownApp.renderer.markdownHooks.on("index.page.end", () =>
      read(options.after),
    );
  };
}
