import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { renderPrintRouteToPdf } from "@/lib/pdf";
import { PORTRAIT_ELEMENT_NOS, PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";

// Playwright needs the Node.js runtime, and every PDF reflects current data.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PDF of /ppap/[id]/[element]/print, rendered by headless Chromium. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; element: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id, element } = await params;
  const ppap = await prisma.ppap.findUnique({ where: { id }, select: { customerId: true } });
  if (!ppap || (user.can.ownCustomerOnly && user.customerId !== ppap.customerId)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const elementNo = Number(element);
  if (!Number.isInteger(elementNo) || !(elementNo in PPAP_ELEMENT_NAMES)) {
    return new NextResponse("Unknown element", { status: 404 });
  }

  const printUrl = new URL(`/ppap/${encodeURIComponent(id)}/${elementNo}/print`, req.url).toString();
  const pdf = await renderPrintRouteToPdf(printUrl, {
    cookie: req.headers.get("cookie"),
    landscape: !PORTRAIT_ELEMENT_NOS.has(elementNo),
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ppap-element-${elementNo}.pdf"`,
    },
  });
}
