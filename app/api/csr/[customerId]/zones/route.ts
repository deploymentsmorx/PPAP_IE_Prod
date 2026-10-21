import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getZoneCriteriaForCustomer } from "@/lib/csr";

/**
 * CSR appearance-zone criteria for a customer (element 17), for AAR
 * (element 13) and other consumers: each zone's rules plus the numbers
 * parsed from them (gloss range/angle, minimum DFT, viewing distance).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { customerId } = await params;
  return NextResponse.json(await getZoneCriteriaForCustomer(customerId));
}
