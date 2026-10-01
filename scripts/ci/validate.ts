import { requireCommand, requireSupportedNode, run } from "#scripts/lib/command";
import { errorLine, step, success } from "#scripts/lib/output";

function runStep(label: string, args: readonly string[]): void {
  console.log(`\n${step(label)}`);
  run("pnpm", args);
}

try {
  requireSupportedNode();
  requireCommand("pnpm");

  runStep("Biome", ["check"]);
  runStep("TypeScript source typecheck", ["typecheck:source"]);
  runStep("TypeScript test typecheck", ["typecheck:test"]);
  runStep("Vitest", ["test"]);
  runStep("Build", ["build"]);
  runStep("Publish shape", ["verify:publish"]);
  runStep("Release metadata", ["verify:release"]);

  console.log(`\n${success("PASS")} All local validation checks passed.`);
} catch (error) {
  console.error(errorLine(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}
