import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

interface Target {
  readonly packageName: string;
  readonly outputPath: string;
}

interface GeneratedPage {
  readonly filename: string;
  readonly linkTargets: ReadonlySet<string>;
  readonly route: string;
}

interface GeneratedPages {
  readonly byFilename: ReadonlyMap<string, GeneratedPage>;
  readonly byRoute: ReadonlyMap<string, GeneratedPage>;
}

const ROOT_PATH = path.resolve(import.meta.dirname, "../../..");

const targets = {
  auth: {
    packageName: "@kysoql/auth",
    outputPath: path.join(ROOT_PATH, "apps/docs/content/docs/auth/api"),
  },
  codegen: {
    packageName: "@kysoql/codegen",
    outputPath: path.join(ROOT_PATH, "apps/docs/content/docs/codegen/api"),
  },
  core: {
    packageName: "@kysoql/core",
    outputPath: path.join(
      ROOT_PATH,
      "apps/docs/content/docs/core/reference/api",
    ),
  },
  jsforce: {
    packageName: "@kysoql/jsforce",
    outputPath: path.join(ROOT_PATH, "apps/docs/content/docs/jsforce/api"),
  },
  rest: {
    packageName: "@kysoql/rest",
    outputPath: path.join(ROOT_PATH, "apps/docs/content/docs/rest/api"),
  },
} as const satisfies Readonly<Record<string, Target>>;

type TargetName = keyof typeof targets;

const contentRoot = path.join(ROOT_PATH, "apps/docs/content/docs");
const frontmatterPattern = /^---\n[\s\S]*?\n---\n*/;
const sectionOrder = [
  "classes",
  "interfaces",
  "type-aliases",
  "functions",
  "variables",
  "enumerations",
  "enums",
  "namespaces",
  "modules",
] as const;

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

function folderTitle(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function pageTitle(filename: string, outputPath: string): string {
  const basename = path.basename(filename, ".mdx");
  if (basename !== "index") {
    return decodeURIComponent(basename);
  }

  if (path.dirname(filename) === outputPath) {
    return "API reference";
  }

  return folderTitle(path.basename(path.dirname(filename)));
}

function generatedFrontmatter(title: string, packageName: string): string {
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(
    `Generated API reference for ${title} in ${packageName}.`,
  )}\ngenerated: true\n---\n\n`;
}

function frontmatterHasIcon(contents: string): boolean {
  const frontmatter = frontmatterPattern.exec(contents)?.[0] ?? "";
  return /^icon:\s*.+$/m.test(frontmatter);
}

async function navigationItemHasIcon(
  directory: string,
  item: string,
): Promise<boolean | undefined> {
  if (
    item.startsWith("---") ||
    item.startsWith("external:") ||
    /^\[[^\]]+\](?:\[[^\]]+\])?\(/.test(item)
  ) {
    return undefined;
  }

  try {
    return frontmatterHasIcon(
      await readFile(path.join(directory, `${item}.mdx`), "utf8"),
    );
  } catch {
    // The item can be a folder instead of a page.
  }

  try {
    const meta = JSON.parse(
      await readFile(path.join(directory, item, "meta.json"), "utf8"),
    ) as { readonly icon?: unknown };
    return typeof meta.icon === "string" && meta.icon.length > 0;
  } catch {
    return undefined;
  }
}

async function parentNavigationUsesIcons(outputPath: string): Promise<boolean> {
  const parentDirectory = path.dirname(outputPath);
  let pages: unknown;

  try {
    const meta = JSON.parse(
      await readFile(path.join(parentDirectory, "meta.json"), "utf8"),
    ) as { readonly pages?: unknown };
    pages = meta.pages;
  } catch {
    return false;
  }

  if (!Array.isArray(pages)) {
    return false;
  }

  const currentItem = path.basename(outputPath);
  const iconStates = await Promise.all(
    pages
      .filter(
        (item): item is string =>
          typeof item === "string" && item !== currentItem,
      )
      .map((item) => navigationItemHasIcon(parentDirectory, item)),
  );
  const siblingIcons = iconStates.filter(
    (state): state is boolean => state !== undefined,
  );

  return siblingIcons.length > 0 && siblingIcons.every(Boolean);
}

function routeForGeneratedFile(filename: string): string | undefined {
  const relative = toPosix(path.relative(contentRoot, filename));
  if (relative.startsWith("../") || !relative.endsWith(".mdx")) {
    return undefined;
  }

  const slug = relative.replace(/\.mdx$/, "").replace(/(^|\/)index$/, "");
  return `/docs${slug ? `/${slug}` : ""}`;
}

function linkTargetIds(contents: string): Set<string> {
  const ids = new Set<string>();
  const counts = new Map<string, number>();

  for (const match of contents.matchAll(/^#{2,6}\s+(.+)$/gm)) {
    const base = match[1]
      ?.toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s/g, "-");
    if (!base) {
      continue;
    }
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    ids.add(count === 0 ? base : `${base}-${count}`);
  }

  for (const match of contents.matchAll(
    /<a\b[^>]*\bid=(["'])([^"']+)\1[^>]*>/gi,
  )) {
    const id = match[2];
    if (id) {
      ids.add(id);
    }
  }

  return ids;
}

async function collectMdxFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMdxFiles(filename)));
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      files.push(filename);
    }
  }

  return files;
}

async function collectGeneratedPages(
  outputPath: string,
): Promise<GeneratedPages> {
  const byFilename = new Map<string, GeneratedPage>();
  const byRoute = new Map<string, GeneratedPage>();

  for (const filename of await collectMdxFiles(outputPath)) {
    const route = routeForGeneratedFile(filename);
    if (!route) {
      continue;
    }
    const page = {
      filename,
      linkTargets: linkTargetIds(await readFile(filename, "utf8")),
      route,
    } satisfies GeneratedPage;
    byFilename.set(filename, page);
    byRoute.set(route, page);
  }

  return { byFilename, byRoute };
}

function resolveAnchor(hash: string, page: GeneratedPage | undefined): string {
  if (!hash || !page) {
    return hash;
  }

  let anchor: string;
  try {
    anchor = decodeURIComponent(hash.slice(1));
  } catch {
    return hash;
  }

  if (page.linkTargets.has(anchor)) {
    return hash;
  }

  // Inherited table-member links can retain TypeDoc's unprefixed fragment
  // even when the destination anchor includes an HTML anchor prefix. Resolve
  // against the destination page instead of assuming the fragment is final.
  const prefixedMatches = [...page.linkTargets].filter((candidate) =>
    candidate.endsWith(`-${anchor}`),
  );
  if (prefixedMatches.length === 1) {
    return `#${prefixedMatches[0]}`;
  }

  const unprefixedMatches = [...page.linkTargets].filter((candidate) =>
    anchor.endsWith(`-${candidate}`),
  );
  if (unprefixedMatches.length === 1) {
    return `#${unprefixedMatches[0]}`;
  }

  return hash;
}

function splitHash(target: string): readonly [string, string] {
  const hashIndex = target.indexOf("#");
  if (hashIndex === -1) {
    return [target, ""];
  }
  return [target.slice(0, hashIndex), target.slice(hashIndex)];
}

function rewriteGeneratedLinks(
  contents: string,
  filename: string,
  pages: GeneratedPages,
): string {
  const currentPage = pages.byFilename.get(filename);

  return contents.replace(
    /(\]\()([^\s)]+)(\))/g,
    (match, open: string, target: string, close: string) => {
      if (/^(?:https?:|mailto:)/.test(target)) {
        return match;
      }

      const [targetPath, hash] = splitHash(target);

      if (!targetPath) {
        const resolvedHash = resolveAnchor(hash, currentPage);
        return `${open}${resolvedHash}${close}`;
      }

      if (targetPath.startsWith("/docs")) {
        const targetPage = pages.byRoute.get(targetPath.replace(/\/$/, ""));
        const resolvedHash = resolveAnchor(hash, targetPage);
        return `${open}${targetPath}${resolvedHash}${close}`;
      }

      if (!targetPath.endsWith(".mdx")) {
        return match;
      }

      const resolved = path.resolve(path.dirname(filename), targetPath);
      const targetPage = pages.byFilename.get(resolved);
      const route = targetPage?.route ?? routeForGeneratedFile(resolved);
      if (!route) {
        return match;
      }

      const resolvedHash = resolveAnchor(hash, targetPage);
      return `${open}${route}${resolvedHash}${close}`;
    },
  );
}

function compareDirectories(a: string, b: string): number {
  const aIndex = sectionOrder.indexOf(a as (typeof sectionOrder)[number]);
  const bIndex = sectionOrder.indexOf(b as (typeof sectionOrder)[number]);
  if (aIndex !== -1 || bIndex !== -1) {
    if (aIndex === -1) {
      return 1;
    }
    if (bIndex === -1) {
      return -1;
    }
    return aIndex - bIndex;
  }

  return a.localeCompare(b, "en");
}

async function processFile(
  filename: string,
  outputPath: string,
  packageName: string,
  pages: GeneratedPages,
): Promise<void> {
  let contents = (await readFile(filename, "utf8")).replace(/\r\n?/g, "\n");
  contents = rewriteGeneratedLinks(contents, filename, pages);

  const isRootIndex = filename === path.join(outputPath, "index.mdx");
  if (!isRootIndex) {
    contents = contents.replace(frontmatterPattern, "");
    contents = `${generatedFrontmatter(
      pageTitle(filename, outputPath),
      packageName,
    )}${contents}`;
  }

  await writeFile(filename, contents);
}

async function processDirectory(
  directory: string,
  outputPath: string,
  packageName: string,
  pages: GeneratedPages,
  rootUsesIcons: boolean,
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(compareDirectories);
  const pageNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => entry.name.replace(/\.mdx$/, ""))
    .sort((a, b) => {
      if (a === "index") {
        return -1;
      }
      if (b === "index") {
        return 1;
      }
      return a.localeCompare(b, "en");
    });

  await Promise.all(
    pageNames.map((page) =>
      processFile(
        path.join(directory, `${page}.mdx`),
        outputPath,
        packageName,
        pages,
      ),
    ),
  );
  for (const child of directories) {
    await processDirectory(
      path.join(directory, child),
      outputPath,
      packageName,
      pages,
      rootUsesIcons,
    );
  }

  const isRoot = directory === outputPath;
  const meta = {
    title: isRoot ? "API reference" : folderTitle(path.basename(directory)),
    ...(isRoot
      ? {
          description: `Generated API reference for ${packageName}.`,
          ...(rootUsesIcons ? { icon: "FileCode" } : {}),
        }
      : {}),
    pages: [...pageNames, ...directories],
  };
  await writeFile(
    path.join(directory, "meta.json"),
    `${JSON.stringify(meta, null, 2)}\n`,
  );
}

export async function postprocessGeneratedDocs(target: Target): Promise<void> {
  await rm(path.join(path.dirname(target.outputPath), "api.mdx"), {
    force: true,
  });
  const pages = await collectGeneratedPages(target.outputPath);
  const rootUsesIcons = await parentNavigationUsesIcons(target.outputPath);
  await processDirectory(
    target.outputPath,
    target.outputPath,
    target.packageName,
    pages,
    rootUsesIcons,
  );
}

const targetName = process.argv[2] as TargetName | undefined;
if (!targetName || !(targetName in targets)) {
  throw new Error(
    `Expected one of ${Object.keys(targets).join(", ")}, received ${JSON.stringify(
      targetName,
    )}`,
  );
}

await postprocessGeneratedDocs(targets[targetName]);
