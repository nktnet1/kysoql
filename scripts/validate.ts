import { requireCommand, requireNode26, run } from "./lib/command.ts";

function runStep(label: string, args: readonly string[]): void {
  console.log(`\n==> ${label}`);
  run("pnpm", args);
}

try {
  requireNode26();
  requireCommand("pnpm");

  runStep("Biome", ["check"]);
  runStep("TypeScript source typecheck", ["typecheck:source"]);
  runStep("TypeScript test typecheck", ["typecheck:test"]);
  runStep("Vitest", ["test"]);
  runStep("Build", ["build"]);
  runStep("Publish shape", ["verify:publish"]);
  runStep("Release metadata", ["verify:release"]);

  console.log("\nAll local validation checks passed.");
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
