import { requireCommand, requireSupportedNode, run } from "../lib/command.ts";

const runStep = (label: string, script: string): void => {
  console.log(`\n==> ${label}`);
  run("pnpm", [script]);
};

requireSupportedNode();
requireCommand("pnpm");
runStep("Validation", "validate");
runStep("Publish-ready release metadata", "verify:release:publish");
runStep("Packed consumer", "verify:packed-consumer");
console.log("\nRelease checks passed.");
