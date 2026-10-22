import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { licenseTokenSecret, verifyLicenseToken } from "@/lib/license-token";

const validationSchema = z.object({
  token: z.string().min(1).max(4096),
  deviceId: z.string().trim().min(1).max(200),
  hostName: z.string().trim().min(1).max(200),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = validationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the validation details." }, { status: 400 });

  const secret = licenseTokenSecret(process.env.AUTH_SECRET);
  if (!secret) return NextResponse.json({ error: "License validation is not configured." }, { status: 503 });

  const claims = verifyLicenseToken(parsed.data.token, secret);
  if (!claims || claims.deviceId !== parsed.data.deviceId || claims.hostName !== parsed.data.hostName) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  const license = await prisma.customerLicense.findUnique({
    where: { id: claims.licenseId },
    select: { status: true, requireDevice: true, deviceId: true, hostName: true, engineerRole: true },
  });
  if (!license || license.status !== "ACTIVE") return NextResponse.json({ valid: false }, { status: 403 });
  if (license.requireDevice && (license.deviceId !== claims.deviceId || license.hostName !== claims.hostName)) {
    return NextResponse.json({ valid: false }, { status: 403 });
  }

  return NextResponse.json({ valid: true, role: license.engineerRole, expiresAt: claims.expiresAt });
}