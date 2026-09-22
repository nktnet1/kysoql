import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  codeBlockIssues,
  codeBlocks,
  contentRoot,
  readPages,
  stripCodeBlocks,
  walk,
} from "./content.mjs";

const errors = [];
const pages = await readPages();
const routes = new Map();
const titles = new Set();
let snippetCount = 0;
let internalLinkCount = 0;
const complain = (page, message) => errors.push(`${page}: ${message}`);

function headingIds(text) {
  const counts = new Map();
  return new Set(
    [...text.matchAll(/^#{2,6}\s+(.+)$/gm)].map((match) => {
      const base = match[1]
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s/g, "-");
      const count = counts.get(base) ?? 0;
      counts.set(base, count + 1);
      return count === 0 ? base : `${base}-${count}`;
    }),
  );
}

for (const page of pages) {
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(page.text);
  if (!frontmatter) {
    complain(page.relative, "missing frontmatter");
    continue;
  }
  // This site deliberately uses JSON-quoted YAML strings for these two keys.
  for (const key of ["title", "description"]) {
    const value = new RegExp(`^${key}: (.+)$`, "m").exec(frontmatter[1])?.[1];
    try {
      const parsed = JSON.parse(value ?? "null");
      assert.equal(typeof parsed, "string");
      assert.ok(parsed.trim().length > 0);
      if (key === "title") {
        if (titles.has(parsed)) {
          complain(page.relative, `duplicate title: ${parsed}`);
        }
        titles.add(parsed);
      }
    } catch {
      complain(
        page.relative,
        `${key} must be a non-empty, double-quoted string`,
      );
    }
  }
  const blocks = codeBlocks(page.text);
  snippetCount += blocks.length;
  for (const block of blocks) {
    for (const issue of codeBlockIssues(block)) {
      complain(page.relative, issue);
    }
  }
  const prose = stripCodeBlocks(page.text, blocks).replace(frontmatter[0], "");
  if (/^# /m.test(prose)) {
    complain(page.relative, "use H2 or lower; the page layout supplies H1");
  }
  if (
    /Hello World|Lorem ipsum|TODO|My App|This is a new docs site/i.test(prose)
  ) {
    complain(page.relative, "starter content or unfinished placeholder found");
  }
  if (routes.has(page.route)) {
    complain(page.relative, `duplicate route: ${page.route}`);
  }
  routes.set(page.route, { ...page, prose, headings: headingIds(prose) });
}

for (const page of routes.values()) {
  const links = page.prose.matchAll(/\[[^\]]+\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g);
  for (const match of links) {
    const target = match[1];
    if (/^(?:https?:|mailto:)/.test(target)) {
      continue;
    }
    if (!target.startsWith("/docs") && !target.startsWith("#")) {
      complain(page.relative, `use an absolute /docs link, found: ${target}`);
      continue;
    }
    internalLinkCount++;
    const url = new URL(target, `https://docs.invalid${page.route}`);
    const destination = routes.get(url.pathname.replace(/\/$/, ""));
    if (!destination) {
      complain(page.relative, `unknown internal page: ${target}`);
    } else if (
      url.hash &&
      !destination.headings.has(decodeURIComponent(url.hash.slice(1)))
    ) {
      complain(page.relative, `unknown heading: ${target}`);
    }
  }
}

const allFiles = await walk(contentRoot);
const metadataFiles = allFiles.filter(
  (file) => path.basename(file) === "meta.json",
);
const rootTabs = ["framework", "core", "rest", "codegen", "jsforce"];
try {
  const rootMeta = JSON.parse(
    await readFile(path.join(contentRoot, "meta.json"), "utf8"),
  );
  assert.deepEqual(
    rootMeta.pages,
    rootTabs,
    "top-level navigation must contain only the peer documentation roots",
  );
  for (const root of rootTabs) {
    const rootMetaFile = path.join(contentRoot, root, "meta.json");
    const rootMetaData = JSON.parse(await readFile(rootMetaFile, "utf8"));
    assert.equal(
      rootMetaData.root,
      true,
      `${root}/meta.json must set root: true so the root toggle stays available`,
    );
  }
} catch (error) {
  complain("meta.json", error instanceof Error ? error.message : String(error));
}
const referenced = new Set();
for (const file of metadataFiles) {
  const label = path.relative(contentRoot, file);
  try {
    const meta = JSON.parse(await readFile(file, "utf8"));
    assert.ok(
      Array.isArray(meta.pages),
      "pages must be an explicit ordered array",
    );
    const seen = new Set();
    for (const item of meta.pages) {
      assert.equal(typeof item, "string");
      assert.ok(!seen.has(item), `duplicate navigation entry: ${item}`);
      seen.add(item);
      if (
        item.startsWith("---") ||
        item.startsWith("external:") ||
        /^\[[^\]]+\](?:\[[^\]]+\])?\(/.test(item)
      ) {
        continue;
      }
      const fileTarget = path.join(path.dirname(file), `${item}.mdx`);
      const folderTarget = path.join(path.dirname(file), item, "meta.json");
      assert.ok(
        allFiles.includes(fileTarget) || allFiles.includes(folderTarget),
        `missing navigation target: ${item}`,
      );
      referenced.add(allFiles.includes(fileTarget) ? fileTarget : folderTarget);
    }
  } catch (error) {
    complain(label, error instanceof Error ? error.message : String(error));
  }
}
for (const file of [...pages.map((page) => page.filename), ...metadataFiles]) {
  if (file !== path.join(contentRoot, "meta.json") && !referenced.has(file)) {
    complain(path.relative(contentRoot, file), "not included in navigation");
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Content checks passed: ${pages.length} pages, ${metadataFiles.length} navigation files, ${snippetCount} code blocks, ${internalLinkCount} internal links.`,
  );
}
