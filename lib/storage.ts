import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/**
 * DEV-ONLY local-disk file storage. The project is meant to use an
 * S3-compatible store (MinIO originally; deferred — see CLAUDE.md) in
 * production. This writes under /storage (gitignored) and serves files
 * back through app/api/files/[...path]/route.ts. Swap this module out
 * (keep the same saveUploadedFile/buildFileUrl signatures) when the
 * object-storage decision is made — nothing above this layer should need
 * to change.
 */

const STORAGE_ROOT = path.join(process.cwd(), "storage");

export async function saveUploadedFile(
  file: File,
  subdir: string,
): Promise<{ url: string; fileName: string; fileType: string }> {
  const dir = path.join(STORAGE_ROOT, subdir);
  await mkdir(dir, { recursive: true });

  const ext = path.extname(file.name);
  const storedName = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, storedName), buffer);

  return {
    url: `/api/files/${subdir}/${storedName}`,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
  };
}

export function resolveStoredFilePath(segments: string[]): string {
  const resolved = path.join(STORAGE_ROOT, ...segments);
  if (!resolved.startsWith(STORAGE_ROOT)) {
    throw new Error("Invalid file path");
  }
  return resolved;
}
