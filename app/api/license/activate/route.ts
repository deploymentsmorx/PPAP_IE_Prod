import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createLicenseToken, licenseTokenSecret } from "@/lib/license-token";

const activationSchema = z.object({
  licenseKey: z.string().trim().min(8).max(80),
  installPassword: z.string().min(10).max(200),
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

  const parsed = activationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the activation details." }, { status: 400 });

  const secret = licenseTokenSecret(process.env.AUTH_SECRET);
  if (!secret) return NextResponse.json({ error: "License activation is not configured." }, { status: 503 });

  const license = await prisma.customerLicense.findUnique({
    where: { licenseKey: parsed.data.licenseKey.toUpperCase() },
    select: {
      id: true,
      status: true,
      requireDevice: true,
      deviceId: true,
      hostName: true,
      installPasswordHash: true,
      companyName: true,
      engineerName: true,
      engineerEmail: true,
      engineerRole: true,
    },
  });

  if (!license || license.status !== "ACTIVE" || !(await bcrypt.compare(parsed.data.installPassword, license.installPasswordHash))) {
    return NextResponse.json({ error: "Unable to activate with these credentials." }, { status: 401 });
  }

  if (license.requireDevice && (license.deviceId !== parsed.data.deviceId || license.hostName !== parsed.data.hostName)) {
    return NextResponse.json({ error: "This license is not approved for this device." }, { status: 403 });
  }

  const token = createLicenseToken({
    licenseId: license.id,
    deviceId: parsed.data.deviceId,
    hostName: parsed.data.hostName,
  }, secret);

  return NextResponse.json({
    token,
    expiresInSeconds: 24 * 60 * 60,
    license: {
      companyName: license.companyName,
      engineerName: license.engineerName,
      engineerEmail: license.engineerEmail,
      role: license.engineerRole,
    },
  });
}