#!/usr/bin/env node

const main = async (): Promise<void> => {
  const [, , command] = process.argv;

  if (command !== "generate") {
    console.error("Usage: kysoql generate");
    process.exitCode = 1;
    return;
  }

  console.error("kysoql schema generation is not implemented yet.");
  process.exitCode = 1;
};

await main();
