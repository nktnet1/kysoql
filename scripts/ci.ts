import { requireCommand, requireSupportedNode, run } from "./lib/command.ts";

const runStep = (label: string, args: readonly string[]): void => {
  console.log(`\n==> ${label}`);
  run("pnpm", args);
};

try {
  requireSupportedNode();
  requireCommand("pnpm");

  runStep("Workspace validation", ["validate"]);
  runStep("Packed consumer verification", ["verify:packed-consumer"]);

  console.log("\nCI checks passed.");
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
