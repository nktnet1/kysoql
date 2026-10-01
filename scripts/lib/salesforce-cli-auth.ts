import { parseJson, run } from "#scripts/lib/command";
import { readSchemaGenerationEnvironment } from "#scripts/lib/environment";
import { repositoryRoot } from "#scripts/lib/oclif";

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

/** Resolve a short-lived session from the repository's authenticated Salesforce CLI org. */
export default async () => {
  const environment = readSchemaGenerationEnvironment();
  const targetOrg =
    environment.KYSOQL_TARGET_ORG ??
    environment.KYSOQL_SCRATCH_ALIAS ??
    "kysoql-test";
  const org = parseJson<OrgDisplayResponse>(
    run(
      "pnpm",
      ["sf", "org", "display", "--target-org", targetOrg, "--json"],
      { cwd: repositoryRoot, capture: true },
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
      { cwd: repositoryRoot, capture: true },
    ),
    "Salesforce access token",
  );
  if (org.status !== 0 || org.result?.instanceUrl === undefined) {
    throw new Error("Salesforce CLI did not return instanceUrl.");
  }
  if (token.status !== 0 || token.result?.accessToken === undefined) {
    throw new Error("Salesforce CLI did not return accessToken.");
  }
  return {
    instanceUrl: org.result.instanceUrl,
    accessToken: token.result.accessToken,
  };
};
