import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const STORAGE_ROOT = path.join(process.cwd(), "storage");
const DEFAULT_S3_PREFIX = "ppap_data_prod";

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".dwg": "application/acad",
  ".dxf": "application/dxf",
  ".step": "application/step",
  ".stp": "application/step",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
};

let s3Client: S3Client | undefined;

function safeSegments(segments: string[]): string[] {
  if (
    !segments.length ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("/") ||
        segment.includes("\\") ||
        segment.includes("\0"),
    )
  ) {
    throw new Error("Invalid file path");
  }

  return segments;
}

function subdirSegments(subdir: string): string[] {
  return safeSegments(subdir.split("/"));
}

function getS3Config(): { bucket: string; client: S3Client } | null {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) return null;

  const region = process.env.S3_REGION?.trim() || process.env.AWS_REGION?.trim();
  if (!region) {
    throw new Error("Set S3_REGION to the AWS region that contains S3_BUCKET.");
  }

  if (!s3Client) {
    const endpoint = process.env.S3_ENDPOINT?.trim();
    s3Client = new S3Client({
      region,
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    });
  }

  return { bucket, client: s3Client };
}

function getS3Key(segments: string[]): string {
  const prefix =
    (process.env.S3_PREFIX?.trim() || DEFAULT_S3_PREFIX).replace(/^\/+|\/+$/g, "") ||
    DEFAULT_S3_PREFIX;
  const prefixParts = prefix ? safeSegments(prefix.split("/")) : [];
  return [...prefixParts, ...safeSegments(segments)].join("/");
}

export function getStoredContentType(fileName: string): string {
  return MIME_BY_EXT[path.extname(fileName).toLowerCase()] ?? "application/octet-stream";
}

export function buildStoredFileUrl(segments: string[]): string {
  return `/api/files/${safeSegments(segments).map(encodeURIComponent).join("/")}`;
}

export async function saveStoredBuffer(
  buffer: Uint8Array,
  segments: string[],
  contentType = "application/octet-stream",
): Promise<void> {
  const safe = safeSegments(segments);
  const s3 = getS3Config();

  if (s3) {
    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: getS3Key(safe),
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return;
  }

  const filePath = resolveStoredFilePath(safe);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
}

export async function saveUploadedFile(
  file: File,
  subdir: string,
): Promise<{ url: string; fileName: string; fileType: string }> {
  const ext = path.extname(file.name).replace(/[^.a-zA-Z0-9_-]/g, "").slice(0, 20);
  const storedName = `${crypto.randomUUID()}${ext}`;
  const segments = [...subdirSegments(subdir), storedName];
  const fileType = file.type || getStoredContentType(storedName);

  await saveStoredBuffer(Buffer.from(await file.arrayBuffer()), segments, fileType);

  return {
    url: buildStoredFileUrl(segments),
    fileName: file.name,
    fileType,
  };
}

export async function readStoredFile(
  segments: string[],
): Promise<{ buffer: Buffer; contentType?: string } | null> {
  const safe = safeSegments(segments);
  const s3 = getS3Config();

  if (s3) {
    try {
      const object = await s3.client.send(
        new GetObjectCommand({ Bucket: s3.bucket, Key: getS3Key(safe) }),
      );
      if (!object.Body) return null;
      return {
        buffer: Buffer.from(await object.Body.transformToByteArray()),
        contentType: object.ContentType,
      };
    } catch (error) {
      const s3Error = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (
        s3Error.name === "NoSuchKey" ||
        s3Error.name === "NotFound" ||
        s3Error.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  try {
    return {
      buffer: await readFile(resolveStoredFilePath(safe)),
      contentType: getStoredContentType(safe.at(-1) ?? ""),
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

export function resolveStoredFilePath(segments: string[]): string {
  const safe = safeSegments(segments);
  const resolved = path.resolve(STORAGE_ROOT, ...safe);
  const relative = path.relative(STORAGE_ROOT, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Invalid file path");
  }
  return resolved;
}
