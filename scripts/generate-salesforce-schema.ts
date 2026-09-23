import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseJson,
  requireCommand,
  requireNode26,
  run,
} from "./lib/command.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

interface OrgDisplayResponse {
  readonly status: number;
  readonly result?: {
    readonly instanceUrl?: string;
  };
}

interface AccessTokenResponse {
  readonly status: number;
  readonly result?: {
    readonly accessToken?: string;
  };
}

try {
  requireNode26();
  requireCommand("pnpm");
  run(
    "pnpm",
    ["exec", "turbo", "run", "build", "--filter=@kysoql/codegen"],
    { cwd: repoRoot },
  );

  const args = process.argv.slice(2);
  if (args[0] === "--") {
    args.shift();
  }

  let accessToken = process.env.SF_ACCESS_TOKEN;
  let instanceUrl = process.env.SF_INSTANCE_URL;
  const hasAccessToken = Boolean(accessToken);
  const hasInstanceUrl = Boolean(instanceUrl);
  if (hasAccessToken !== hasInstanceUrl) {
    throw new Error(
      "SF_ACCESS_TOKEN and SF_INSTANCE_URL must either both be set or both be unset.",
    );
  }

  if (!accessToken || !instanceUrl) {
    const targetOrg =
      process.env.KYSOQL_TARGET_ORG ??
      process.env.KYSOQL_SCRATCH_ALIAS ??
      "kysoql-test";
    const org = parseJson<OrgDisplayResponse>(
      run(
        "pnpm",
        ["sf", "org", "display", "--target-org", targetOrg, "--json"],
        { cwd: repoRoot, capture: true },
      ),
      "Salesforce org display",
    );
    const token = parseJson<AccessTokenResponse>(
      run(
        "pnpm",
        [
          "sf",
          "org",
          "auth",
          "show-access-token",
          "--target-org",
          targetOrg,
          "--json",
        ],
        { cwd: repoRoot, capture: true },
      ),
      "Salesforce access token",
    );
    if (org.status !== 0 || !org.result?.instanceUrl) {
      throw new Error("Salesforce CLI did not return instanceUrl.");
    }
    if (token.status !== 0 || !token.result?.accessToken) {
      throw new Error("Salesforce CLI did not return accessToken.");
    }
    instanceUrl = org.result.instanceUrl;
    accessToken = token.result.accessToken;
  }

  run(process.execPath, ["packages/codegen/dist/cli.mjs", "generate", ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SF_INSTANCE_URL: instanceUrl,
      SF_ACCESS_TOKEN: accessToken,
    },
  });
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
