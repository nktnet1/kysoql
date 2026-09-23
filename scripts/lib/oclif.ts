import { resolve } from "node:path";

export const repositoryRoot = resolve(import.meta.dirname, "../..");

export const repositoryCommandLoadOptions = {
  root: repositoryRoot,
  pjson: {
    name: "kysoql",
    version: "0.0.0",
    oclif: {
      bin: "kysoql",
      dirname: "kysoql",
    },
  },
};
