import { requireCommand, requireSupportedNode, run } from "../lib/command.ts";
import { step, success } from "../lib/output.ts";

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
