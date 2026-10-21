import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { buildPack, buildPackZip, getSubmissionPlan } from "@/lib/pack";
import { exportFullWorkbook } from "@/lib/workbook-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PPAP pack downloads: ?format=pdf (one bookmarked PDF), zip (4 reference
 * folders + pack + workbook) or xlsx (20-sheet workbook).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const ppap = await prisma.ppap.findUnique({ where: { id }, include: { partRevision: { include: { part: true } } } });
  if (!ppap || (user.can.ownCustomerOnly && user.customerId !== ppap.customerId)) return new NextResponse("Not found", { status: 404 });

  const format = new URL(req.url).searchParams.get("format") ?? "pdf";
  const base = `PPAP ${ppap.partRevision.part.partNumber} Rev ${ppap.partRevision.revision}`.replace(/[\\/:*?"<>|]/g, "_");

  if (format === "xlsx") {
    const wb = await exportFullWorkbook(id);
    return new NextResponse(new Uint8Array(await wb.xlsx.writeBuffer()), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${base}.xlsx"` },
    });
  }

  // ?format=pdf&set=final — the final submission for the chosen level: PSW first, then that level's documents.
  if (format === "pdf" && new URL(req.url).searchParams.get("set") === "final") {
    const plan = await getSubmissionPlan(id);
    if (!plan.confirmed) return new NextResponse("Choose and confirm the submission level on the pack page first.", { status: 409 });
    const final = await buildPack(id, new URL(req.url).origin, req.headers.get("cookie"), plan.elementNos);
    return new NextResponse(new Uint8Array(final.pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base} - Level ${plan.level} final PPAP.pdf"` },
    });
  }

  const pack = await buildPack(id, new URL(req.url).origin, req.headers.get("cookie"));
  if (format === "zip") {
    const zip = await buildPackZip(id, pack, `${base} - pack.pdf`);
    return new NextResponse(new Uint8Array(zip), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${base}.zip"` } });
  }
  return new NextResponse(new Uint8Array(pack.pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base} - pack.pdf"` } });
}
