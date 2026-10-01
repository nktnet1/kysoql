import { parseReleaseVersion } from "#scripts/release/policy";

/** Select a beta above the manifest, registry versions, and existing Git tags. */
export const nextBetaVersion = (
  base: string,
  current: string,
  published: readonly string[],
  tags: readonly string[],
): string => {
  const parsedBase = parseReleaseVersion(base);
  if (parsedBase.beta !== undefined) {
    throw new Error(`Beta base must be a stable x.y.z version: ${base}`);
  }

  if (published.includes(parsedBase.base)) {
    throw new Error(
      `${parsedBase.base} is already released; choose a new beta base version`,
    );
  }

  let highest = 0n;
  for (const candidate of [
    current,
    ...published,
    ...tags.map((tag) => tag.replace(/^v/u, "")),
  ]) {
    let parsed: ReturnType<typeof parseReleaseVersion>;
    try {
      parsed = parseReleaseVersion(candidate);
    } catch {
      // Bootstrap placeholders and unrelated prerelease channels are irrelevant.
      continue;
    }
    if (parsed.base !== parsedBase.base || parsed.beta === undefined) {
      continue;
    }
    const number = BigInt(parsed.beta);
    if (number > highest) {
      highest = number;
    }
  }

  return `${parsedBase.base}-beta.${highest + 1n}`;
};
