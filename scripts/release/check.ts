import { requireCommand, requireSupportedNode, run } from "#scripts/lib/command";
import { step, success } from "#scripts/lib/output";

const runStep = (label: string, script: string): void => {
  console.log(`\n${step(label)}`);
  run("pnpm", [script]);
};

requireSupportedNode();
requireCommand("pnpm");
runStep("Validation", "validate");
runStep("Publish-ready release metadata", "verify:release:publish");
runStep("Packed consumer", "verify:packed-consumer");
console.log(`\n${success("PASS")} Release checks passed.`);
