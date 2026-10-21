import { readFile, stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveStoredFilePath } from "@/lib/storage";

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
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { path: segments } = await params;

  let filePath: string;
  try {
    filePath = resolveStoredFilePath(segments);
  } catch {
    return new NextResponse("Invalid path", { status: 400 });
  }

  try {
    await stat(filePath);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const buffer = await readFile(filePath);
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
