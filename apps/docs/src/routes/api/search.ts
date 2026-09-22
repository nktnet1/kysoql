import { createFileRoute } from "@tanstack/react-router";
import { createFromSource } from "fumadocs-core/search/server";
import { getDocsSectionTag } from "@/lib/docs-packages";
import { source } from "@/lib/source";

const server = createFromSource(source, {
  // https://docs.orama.com/docs/orama-js/supported-languages
  language: "english",
  async buildIndex(page) {
    return {
      title: page.data.title,
      description: page.data.description,
      url: page.url,
      id: page.url,
      structuredData: await page.data.structuredData(),
      tag: getDocsSectionTag(page.slugs),
    };
  },
});

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: () => server.staticGET(),
    },
  },
});
