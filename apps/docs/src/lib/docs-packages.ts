export const docsSections = [
  {
    slug: "framework",
    label: "Framework",
    description:
      "General Kysoql usage across schema generation, query building, and execution.",
  },
  {
    slug: "core",
    label: "Core",
    description: "Query building, compile-time types, and SOQL generation.",
  },
  {
    slug: "rest",
    label: "REST",
    description: "Native Salesforce REST execution and authentication.",
  },
  {
    slug: "codegen",
    label: "Codegen",
    description: "Schema generation, configuration, and field filtering.",
  },
  {
    slug: "jsforce",
    label: "JSforce",
    description: "Optional executor adapter for existing JSforce clients.",
  },
] as const;

export type DocsSectionSlug = (typeof docsSections)[number]["slug"];

export function getDocsSectionTag(slugs: readonly string[]): DocsSectionSlug {
  const [root] = slugs;
  const section = docsSections.find((entry) => entry.slug === root);
  return section?.slug ?? "framework";
}
