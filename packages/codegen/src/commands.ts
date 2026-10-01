import type { Command } from "@oclif/core";

import Generate from "#src/commands/generate";

export const COMMANDS = {
  generate: Generate,
} satisfies Record<string, Command.Class>;
