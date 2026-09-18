import type { Command } from "@oclif/core";

import Generate from "#/commands/generate";

export const COMMANDS = {
  generate: Generate,
} satisfies Record<string, Command.Class>;
