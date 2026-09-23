import { stat } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { createJiti } from "jiti";

import type { SalesforceAuthProvider } from "#/config";

const extensions = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];

const isFile = async (filename: string): Promise<boolean> => {
  try {
    return (await stat(filename)).isFile();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

/** Load a trusted module whose default export resolves a Salesforce session. */
export const loadAuthProvider = async (
  authFile: string,
  cwd = process.cwd(),
): Promise<SalesforceAuthProvider> => {
  if (!authFile.trim()) {
    throw new Error("--auth requires a non-blank path.");
  }
  const filename = resolve(cwd, authFile);
  if (!extensions.includes(extname(filename))) {
    throw new Error(
      `Unsupported Kysoql auth extension: ${filename}. Use ${extensions.join(", ")}.`,
    );
  }
  if (!(await isFile(filename))) {
    throw new Error(`Kysoql auth module not found: ${filename}`);
  }

  let input: unknown;
  try {
    const jiti = createJiti(filename, {
      interopDefault: false,
      moduleCache: false,
      tryNative: false,
    });
    const module = await jiti.import<unknown>(filename);
    if (module !== null && typeof module === "object" && "default" in module) {
      input = module.default;
    } else if ([".cts", ".cjs"].includes(extname(filename))) {
      input = module;
    } else {
      throw new TypeError(
        "Expected a default-exported authentication provider.",
      );
    }
  } catch (error) {
    throw new Error(
      `Unable to load Kysoql auth module ${filename}: ` +
        (error instanceof Error ? error.message : "module evaluation failed"),
      { cause: error },
    );
  }

  if (typeof input !== "function") {
    throw new TypeError(
      `Invalid Kysoql auth module ${filename}: expected a function.`,
    );
  }
  return input as SalesforceAuthProvider;
};
