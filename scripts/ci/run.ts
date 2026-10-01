import { requireCommand, requireSupportedNode, run } from "#scripts/lib/command";
import { errorLine, step, success } from "#scripts/lib/output";

const runStep = (label: string, args: readonly string[]): void => {
  console.log(`\n${step(label)}`);
  run("pnpm", args);
};

try {
  requireSupportedNode();
  requireCommand("pnpm");

  runStep("Workspace validation", ["validate"]);
  runStep("Packed consumer verification", ["verify:packed-consumer"]);

  console.log(`\n${success("PASS")} CI checks passed.`);
} catch (error) {
  console.error(errorLine(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}
