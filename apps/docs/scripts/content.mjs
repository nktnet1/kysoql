import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const docsRoot = fileURLToPath(new URL("../", import.meta.url));
export const contentRoot = path.join(docsRoot, "content/docs");

export async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const filename = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(filename) : [filename];
    }),
  );
  return files.flat().sort();
}

export async function readPages() {
  const filenames = (await walk(contentRoot)).filter((file) =>
    file.endsWith(".mdx"),
  );
  return Promise.all(
    filenames.map(async (filename) => {
      const relative = path
        .relative(contentRoot, filename)
        .split(path.sep)
        .join("/");
      const slug = relative.replace(/\.mdx$/, "").replace(/(^|\/)index$/, "");
      return {
        filename,
        relative,
        route: `/docs${slug ? `/${slug}` : ""}`.replace(/\/$/, ""),
        text: (await readFile(filename, "utf8")).replace(/\r\n?/g, "\n"),
      };
    }),
  );
}

const languageAliases = new Map([
  ["typescript", "ts"],
  ["javascript", "js"],
  ["sh", "bash"],
  ["shell", "bash"],
  ["shellscript", "bash"],
  ["plaintext", "text"],
  ["txt", "text"],
  ["yml", "yaml"],
]);
const languages = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "bash",
  "json",
  "yaml",
  "text",
  "sql",
  "apex",
  "npm",
]);

/**
 * Read top-level Markdown fences, keeping language and metadata separate.
 * Both consumers use this parser so a valid TypeScript alias cannot silently
 * bypass example typechecking. Line numbers are one-based, including fences.
 */
export function codeBlocks(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let open;
  const finish = (end, closed) => {
    const code = lines.slice(open.fenceLine, end).map((line) => {
      const spaces = /^ */.exec(line)[0].length;
      return line.slice(Math.min(spaces, open.indent));
    });
    blocks.push({
      ...open,
      code: code.join("\n"),
      endLine: closed ? end + 1 : lines.length,
      closed,
    });
    open = undefined;
  };

  for (let index = 0; index < lines.length; index++) {
    const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(lines[index]);
    if (!match) {
      continue;
    }
    const [, indent, fence, rest] = match;
    if (open) {
      if (
        fence[0] === open.fence[0] &&
        fence.length >= open.fence.length &&
        /^[ \t]*$/.test(rest)
      ) {
        finish(index, true);
      }
      continue;
    }
    // Backticks in an opening backtick fence's info string are not Markdown.
    if (fence[0] === "`" && rest.includes("`")) {
      continue;
    }
    const info = rest.trim();
    const label = /^(\S+)/.exec(info)?.[1] ?? "";
    open = {
      fence,
      indent: indent.length,
      info,
      label,
      language: languageAliases.get(label) ?? label,
      metadata: info.slice(label.length).trim(),
      fenceLine: index + 1,
      line: index + 2,
    };
  }
  if (open) {
    finish(lines.length, false);
  }
  return blocks;
}

/** Mask code (including malformed fences) before checking prose and links. */
export function stripCodeBlocks(text, blocks = codeBlocks(text)) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  for (const block of blocks) {
    lines.fill("", block.fenceLine - 1, block.endLine);
  }
  return lines.join("\n");
}

export function codeBlockIssues(block) {
  const issues = [];
  const at = `line ${block.fenceLine}`;
  if (!block.closed) {
    issues.push(`${at}: unclosed code fence`);
  }
  if (!languages.has(block.language)) {
    issues.push(
      `${at}: missing/unknown code language ${JSON.stringify(block.label)} ` +
        `(fence info: ${JSON.stringify(block.info)}); ` +
        "use a supported language such as ts, typescript, bash, json, or text",
    );
  }
  if (!block.code.trim()) {
    issues.push(`${at}: empty code example`);
  }
  if (block.language === "json") {
    try {
      JSON.parse(block.code);
    } catch {
      issues.push(`${at}: invalid JSON`);
    }
  }
  if (["ts", "tsx", "js", "jsx"].includes(block.language)) {
    const imports = block.code.matchAll(
      /\b(?:from\s*|import\s*\(\s*|import\s*)["'](\.{1,2}\/[^"']+\.js)["']/g,
    );
    for (const match of imports) {
      issues.push(`${at}: use an extensionless local import: ${match[1]}`);
    }
  }
  return issues;
}
