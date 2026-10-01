export interface PublicExportShape {
  readonly all: ReadonlySet<string>;
  readonly runtime: ReadonlySet<string>;
}

const fail = (context: string, message: string): never => {
  throw new Error(`Publish-shape verification failed: ${context} ${message}`);
};

const scrubCommentsAndStrings = (source: string): string => {
  const output = [...source];
  let index = 0;
  let state:
    | "code"
    | "line-comment"
    | "block-comment"
    | "single-quote"
    | "double-quote"
    | "template" = "code";
  let escaped = false;

  const scrub = (position: number): void => {
    if (output[position] !== "\n" && output[position] !== "\r") {
      output[position] = " ";
    }
  };

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (state === "code") {
      if (char === "/" && next === "/") {
        scrub(index);
        scrub(index + 1);
        index += 2;
        state = "line-comment";
        continue;
      }

      if (char === "/" && next === "*") {
        scrub(index);
        scrub(index + 1);
        index += 2;
        state = "block-comment";
        continue;
      }

      if (char === "'") {
        scrub(index);
        index += 1;
        state = "single-quote";
        escaped = false;
        continue;
      }

      if (char === '"') {
        scrub(index);
        index += 1;
        state = "double-quote";
        escaped = false;
        continue;
      }

      if (char === "`") {
        scrub(index);
        index += 1;
        state = "template";
        escaped = false;
        continue;
      }

      index += 1;
      continue;
    }

    if (state === "line-comment") {
      if (char === "\n" || char === "\r") {
        state = "code";
      } else {
        scrub(index);
      }
      index += 1;
      continue;
    }

    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        scrub(index);
        scrub(index + 1);
        index += 2;
        state = "code";
      } else {
        scrub(index);
        index += 1;
      }
      continue;
    }

    scrub(index);

    if (escaped) {
      escaped = false;
      index += 1;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      index += 1;
      continue;
    }

    const closesString =
      (state === "single-quote" && char === "'") ||
      (state === "double-quote" && char === '"') ||
      (state === "template" && char === "`");
    if (closesString) {
      state = "code";
    }

    index += 1;
  }

  return output.join("");
};

const NAMED_EXPORT_PATTERN =
  /^[\t ]*export[\t ]+(type[\t ]+)?\{([^}]*)\}/gmu;
const NAMESPACE_EXPORT_PATTERN =
  /^[\t ]*export[\t ]+(type[\t ]+)?\*[\t ]+as[\t ]+([A-Za-z_$][A-Za-z0-9_$]*)/gmu;
const BARE_WILDCARD_EXPORT_PATTERN =
  /^[\t ]*export[\t ]+(?:type[\t ]+)?\*[\t ]+from\b/mu;
const EXPORT_EQUALS_PATTERN = /^[\t ]*export[\t ]*=/mu;
const DEFAULT_EXPORT_PATTERN = /^[\t ]*export[\t ]+default\b/mu;
const DEFAULT_TYPE_ONLY_EXPORT_PATTERN =
  /^[\t ]*export[\t ]+default[\t ]+interface\b/mu;
const DIRECT_EXPORT_PATTERN =
  /^[\t ]*export[\t ]+(declare[\t ]+)?(?:(?:abstract|async)[\t ]+)?(interface|type|class|function|enum|namespace|module|const|let|var)[\t ]+([A-Za-z_$][A-Za-z0-9_$]*)/gmu;
const EXPORTED_NAME_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;
const CONST_ENUM_NAME_PATTERN = /^[\t ]+([A-Za-z_$][A-Za-z0-9_$]*)/u;
const SPECIFIER_WHITESPACE_PATTERN = /\s+/u;

export const collectPublicExports = (
  source: string,
  context: string,
): PublicExportShape => {
  const scrubbed = scrubCommentsAndStrings(source);
  const all = new Set<string>();
  const runtime = new Set<string>();

  const add = (name: string, runtimeExport: boolean): void => {
    all.add(name);
    if (runtimeExport) {
      runtime.add(name);
    }
  };

  if (BARE_WILDCARD_EXPORT_PATTERN.test(scrubbed)) {
    return fail(
      context,
      "uses a wildcard export, which cannot be verified for exact publish parity.",
    );
  }

  if (EXPORT_EQUALS_PATTERN.test(scrubbed)) {
    return fail(context, "uses unsupported export-equals syntax.");
  }

  for (const match of scrubbed.matchAll(NAMED_EXPORT_PATTERN)) {
    const block = match[2];
    if (block === undefined) {
      return fail(context, "contains an invalid named export list.");
    }

    const statementTypeOnly = match[1] !== undefined;
    for (const rawSpecifier of block.split(",")) {
      const specifier = rawSpecifier.trim();
      if (specifier.length === 0) {
        continue;
      }

      const parts = specifier.split(SPECIFIER_WHITESPACE_PATTERN);
      const itemTypeOnly = parts[0] === "type";
      const normalized = itemTypeOnly ? parts.slice(1) : parts;
      const asIndex = normalized.lastIndexOf("as");
      const exportedName =
        asIndex >= 0 ? normalized[asIndex + 1] : normalized[0];

      if (
        exportedName === undefined ||
        !EXPORTED_NAME_PATTERN.test(exportedName)
      ) {
        return fail(context, "contains an unsupported named export.");
      }

      add(exportedName, !statementTypeOnly && !itemTypeOnly);
    }
  }

  for (const match of scrubbed.matchAll(NAMESPACE_EXPORT_PATTERN)) {
    const name = match[2];
    if (name === undefined) {
      return fail(context, "contains an invalid namespace export.");
    }
    add(name, match[1] === undefined);
  }

  if (DEFAULT_EXPORT_PATTERN.test(scrubbed)) {
    add("default", !DEFAULT_TYPE_ONLY_EXPORT_PATTERN.test(scrubbed));
  }

  for (const match of scrubbed.matchAll(DIRECT_EXPORT_PATTERN)) {
    const kind = match[2];
    const name = match[3];
    if (kind === undefined || name === undefined) {
      return fail(context, "contains an invalid exported declaration.");
    }

    // `export const enum Foo` is captured as `const enum`; it is type-only.
    if (kind === "const" && name === "enum") {
      const remainder = scrubbed.slice(match.index + match[0].length);
      const enumName = CONST_ENUM_NAME_PATTERN.exec(remainder)?.[1];
      if (enumName === undefined) {
        return fail(context, "contains an invalid exported const enum.");
      }
      add(enumName, false);
      continue;
    }

    const isTypeOnly = kind === "interface" || kind === "type";
    const isDeclare = match[1] !== undefined;
    add(name, !isTypeOnly && !isDeclare);
  }

  return { all, runtime };
};
