import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStoredContentType, readStoredFile } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { path: segments } = await params;

  let storedFile: Awaited<ReturnType<typeof readStoredFile>>;
  try {
    storedFile = await readStoredFile(segments);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid file path") {
      return new NextResponse("Invalid path", { status: 400 });
    }
    return new NextResponse("File storage unavailable", { status: 502 });
  }

  if (!storedFile) {
    return new NextResponse("Not found", { status: 404 });
  }

  const fileName = segments.at(-1) ?? "";
  const contentType = getStoredContentType(fileName);

  return new NextResponse(new Uint8Array(storedFile.buffer), {
    headers: {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
