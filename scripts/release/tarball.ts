import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const TAR_BLOCK_BYTES = 512;
const MAX_PACKAGE_ARCHIVE_BYTES = 256 * 1024 * 1024;
const MAX_PACKAGE_MANIFEST_BYTES = 1024 * 1024;

const readTarString = (
  block: Buffer,
  offset: number,
  length: number,
): string => {
  const field = block.subarray(offset, offset + length);
  const end = field.indexOf(0);
  return field.subarray(0, end === -1 ? field.length : end).toString("utf8");
};

const readTarSize = (block: Buffer): number => {
  const value = readTarString(block, 124, 12).trim();
  if (!/^[0-7]+$/u.test(value)) {
    throw new Error("Invalid tar entry size");
  }
  const size = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(size)) {
    throw new Error("Invalid tar entry size");
  }
  return size;
};

export const readPackageManifestFromTarball = (
  file: string,
): Readonly<Record<string, unknown>> => {
  const archive = gunzipSync(readFileSync(file), {
    maxOutputLength: MAX_PACKAGE_ARCHIVE_BYTES,
  });

  for (let offset = 0; offset + TAR_BLOCK_BYTES <= archive.length; ) {
    const header = archive.subarray(offset, offset + TAR_BLOCK_BYTES);
    if (header.every((byte) => byte === 0)) {
      break;
    }

    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const entry = prefix ? `${prefix}/${name}` : name;
    const size = readTarSize(header);
    const dataStart = offset + TAR_BLOCK_BYTES;
    const dataEnd = dataStart + size;
    if (dataEnd > archive.length) {
      throw new Error(`Truncated tarball: ${file}`);
    }

    if (entry === "package/package.json") {
      if (size > MAX_PACKAGE_MANIFEST_BYTES) {
        throw new Error(`Package manifest is too large: ${file}`);
      }
      const manifest: unknown = JSON.parse(
        archive.subarray(dataStart, dataEnd).toString("utf8"),
      );
      if (
        typeof manifest !== "object" ||
        manifest === null ||
        Array.isArray(manifest)
      ) {
        throw new Error(`Invalid package manifest: ${file}`);
      }
      return manifest as Readonly<Record<string, unknown>>;
    }

    offset = dataStart + Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
  }

  throw new Error(`Package manifest not found: ${file}`);
};
