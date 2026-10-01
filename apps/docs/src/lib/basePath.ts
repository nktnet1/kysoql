export function normalizeBasePath(value: string | undefined): string {
  const path = (value ?? "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");

  return path ? `/${path}` : "/";
}

export function getBasePath(): string {
  return normalizeBasePath(import.meta.env.PUBLIC_DOCS_BASE_PATH);
}
