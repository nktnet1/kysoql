import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

import { parseJson, requireCommand, run } from "../lib/command.ts";
import { RELEASE_PACKAGES } from "./policy.ts";

const DEFAULT_REGISTRY = "https://registry.npmjs.org/";
const REPOSITORY = "nktnet1/kysoql";
const WORKFLOW = "publish.yml";
const ENVIRONMENT = "Production";
const SCOPE = "@kysoql";

interface StructuredRegistryAuth {
  readonly [scope: string]:
    | {
        readonly authToken?: unknown;
      }
    | undefined;
}

interface StructuredAuth {
  readonly [registry: string]: StructuredRegistryAuth | undefined;
}

const { values } = parseArgs({
  options: {
    registry: { type: "string", default: DEFAULT_REGISTRY },
    help: { type: "boolean", short: "h", default: false },
  },
});

const registry = values.registry ?? DEFAULT_REGISTRY;
const registryUrl = new URL(registry);
if (
  !["https:", "http:"].includes(registryUrl.protocol) ||
  registryUrl.username ||
  registryUrl.password
) {
  throw new Error(
    "Registry must be an HTTP(S) URL without embedded credentials",
  );
}

const normalizeRegistry = (url: URL): string => {
  const pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  return `${url.origin}${pathname}`;
};

const legacyAuthKey = (url: URL): string => {
  const pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  return `//${url.host}${pathname}:_authToken`;
};

const readPnpmAuthToken = (): string => {
  try {
    const raw = run("pnpm", ["config", "get", "--json", "_auth"], {
      capture: true,
    }).trim();
    if (raw.length > 0 && raw !== "null" && raw !== "undefined") {
      const auth = parseJson<StructuredAuth>(raw, "pnpm config get _auth");
      const registryAuth = auth[normalizeRegistry(registryUrl)];
      for (const key of [SCOPE, "@"]) {
        const token = registryAuth?.[key]?.authToken;
        if (typeof token === "string" && token.length > 0) {
          return token;
        }
      }
    }
  } catch {
    // Fall back to legacy URL-scoped auth below.
  }

  try {
    const token = run(
      "pnpm",
      ["config", "get", legacyAuthKey(registryUrl)],
      { capture: true },
    ).trim();
    if (token.length > 0 && token !== "null" && token !== "undefined") {
      return token;
    }
  } catch {
    // Fall through to the actionable error below.
  }

  throw new Error(
    `No pnpm authentication token found for ${registry}. ` +
      `Run pnpm login --registry=${registry} first.`,
  );
};

const packageTrustUrl = (packageName: string): URL => {
  const escaped = encodeURIComponent(packageName).replace(/^%40/u, "@");
  return new URL(`-/package/${escaped}/trust`, normalizeRegistry(registryUrl));
};

const readJsonResponse = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const responseMessage = (body: unknown): string => {
  if (typeof body === "string") {
    return body;
  }
  if (typeof body === "object" && body !== null && !Array.isArray(body)) {
    for (const key of ["message", "error"]) {
      const value = (body as Readonly<Record<string, unknown>>)[key];
      if (typeof value === "string") {
        return value;
      }
    }
  }
  return JSON.stringify(body) ?? String(body);
};

const requiresOtp = (response: Response, body: unknown): boolean =>
  [401, 403].includes(response.status) &&
  (/otp|one[- ]time|two[- ]factor|2fa/iu.test(responseMessage(body)) ||
    /otp/iu.test(response.headers.get("www-authenticate") ?? ""));

const promptForOtp = async (): Promise<string> => {
  const configured = process.env.PNPM_CONFIG_OTP?.trim();
  if (configured) {
    return configured;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Trusted-publisher setup requires 2FA. Set PNPM_CONFIG_OTP to a current " +
        "one-time code and rerun pnpm oidc:trust.",
    );
  }

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const otp = (await prompt.question("registry one-time code: ")).trim();
    if (!otp) {
      throw new Error("A one-time code is required");
    }
    return otp;
  } finally {
    prompt.close();
  }
};

const desiredTrust = {
  type: "github",
  claims: {
    repository: REPOSITORY,
    workflow_ref: { file: WORKFLOW },
    environment: ENVIRONMENT,
  },
  permissions: ["createPackage"],
} as const;

const isDesiredTrust = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const config = value as Readonly<Record<string, unknown>>;
  if (config.type !== desiredTrust.type) {
    return false;
  }
  const claims = config.claims;
  if (typeof claims !== "object" || claims === null || Array.isArray(claims)) {
    return false;
  }
  const claimMap = claims as Readonly<Record<string, unknown>>;
  const workflowRef = claimMap.workflow_ref;
  if (
    typeof workflowRef !== "object" ||
    workflowRef === null ||
    Array.isArray(workflowRef)
  ) {
    return false;
  }
  const permissions = config.permissions;
  return (
    claimMap.repository === REPOSITORY &&
    claimMap.environment === ENVIRONMENT &&
    (workflowRef as Readonly<Record<string, unknown>>).file === WORKFLOW &&
    Array.isArray(permissions) &&
    permissions.includes("createPackage")
  );
};

const requestTrust = async (
  packageName: string,
  method: "GET" | "POST",
  token: string,
  otp?: string,
): Promise<{ readonly response: Response; readonly body: unknown }> => {
  const response = await fetch(packageTrustUrl(packageName), {
    method,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
      ...(otp ? { "npm-otp": otp } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify([desiredTrust]) } : {}),
  });
  return { response, body: await readJsonResponse(response) };
};

const configurePackage = async (
  packageName: string,
  token: string,
  otp: string | undefined,
): Promise<string | undefined> => {
  const existing = await requestTrust(packageName, "GET", token);
  if (!existing.response.ok) {
    throw new Error(
      `Unable to inspect trusted publishing for ${packageName}: ` +
        `${existing.response.status} ${responseMessage(existing.body)}`,
    );
  }

  const configs = Array.isArray(existing.body) ? existing.body : [];
  if (configs.some(isDesiredTrust)) {
    console.log(`SKIP ${packageName} already has the expected trusted publisher`);
    return otp;
  }
  if (configs.length > 0) {
    throw new Error(
      `${packageName} already has a different trusted publisher. ` +
        "Review it in the registry before replacing it.",
    );
  }

  let currentOtp = otp;
  let created = await requestTrust(packageName, "POST", token, currentOtp);
  if (!created.response.ok && requiresOtp(created.response, created.body)) {
    currentOtp = await promptForOtp();
    created = await requestTrust(packageName, "POST", token, currentOtp);
  }
  if (!created.response.ok) {
    throw new Error(
      `Unable to configure trusted publishing for ${packageName}: ` +
        `${created.response.status} ${responseMessage(created.body)}`,
    );
  }

  console.log(`CONFIGURED ${packageName}`);
  return currentOtp;
};

const printHelp = (): void => {
  console.log(`Usage:
  pnpm oidc:trust [-- --registry <url>]

Configures the GitHub Actions trusted publisher for every @kysoql package by
calling the registry trust API directly. Authentication is read from pnpm's
credential store, so run pnpm login first. pnpm is the only package-manager CLI used.

Publisher:
  repository: ${REPOSITORY}
  workflow:   ${WORKFLOW}
  environment:${ENVIRONMENT}
  permission: direct publish

If the registry requires 2FA, the command prompts for a one-time code. In a
non-interactive shell, set PNPM_CONFIG_OTP to a current code.`);
};

const main = async (): Promise<void> => {
  if (values.help) {
    printHelp();
    return;
  }

  requireCommand("pnpm");
  const token = readPnpmAuthToken();
  let otp = process.env.PNPM_CONFIG_OTP?.trim() || undefined;

  for (const definition of RELEASE_PACKAGES) {
    otp = await configurePackage(definition.name, token, otp);
  }
};

await main();
