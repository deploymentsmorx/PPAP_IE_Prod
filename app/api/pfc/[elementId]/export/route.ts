import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { exportPfcWorkbook } from "@/lib/pfc-import";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ elementId: string }> },
) {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { elementId } = await params;
  const workbook = await exportPfcWorkbook(elementId);
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="process-flow-chart.xlsx"',
    },
  });
}
