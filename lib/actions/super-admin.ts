"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { LicenseStatus, Prisma, UserRole } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertCan } from "@/lib/permissions";

const teamRoleSchema = z.enum(["ADMIN", "QA_MANAGER", "ENGINEERING", "LEAD"]);

export type TeamAccountState =
  | { error: string }
  | { created: { name: string; email: string; role: string; temporaryPassword: string } }
  | undefined;

export type CustomerLicenseState =
  | { error: string }
  | { created: { companyName: string; licenseKey: string; installPassword: string; temporaryPassword: string } }
  | undefined;

const read = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const checked = (formData: FormData, key: string) => formData.get(key) === "on";
const autoPassword = () => randomBytes(12).toString("base64url");
const generatedLicenseKey = () => `SMX-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;

export async function createTeamAccount(_previous: TeamAccountState, formData: FormData): Promise<TeamAccountState> {
  await assertCan("manageLicenses", "Only a Super Admin can create team accounts.");
  const parsed = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    role: teamRoleSchema,
    temporaryPassword: z.string().trim().optional(),
  }).safeParse({
    name: read(formData, "name"),
    email: read(formData, "email").toLowerCase(),
    role: read(formData, "role"),
    temporaryPassword: read(formData, "temporaryPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the account details." };

  const temporaryPassword = parsed.data.temporaryPassword || autoPassword();
  if (temporaryPassword.length < 8) return { error: "Temporary passwords must be at least 8 characters." };

  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await bcrypt.hash(temporaryPassword, 12),
        roles: [parsed.data.role as UserRole],
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "An account with this email already exists." };
    }
    throw error;
  }

  revalidatePath("/super-admin");
  revalidatePath("/users");
  return { created: { name: parsed.data.name, email: parsed.data.email, role: parsed.data.role, temporaryPassword } };
}

export async function createCustomerLicense(_previous: CustomerLicenseState, formData: FormData): Promise<CustomerLicenseState> {
  const actor = await assertCan("manageLicenses", "Only a Super Admin can create customer licenses.");
  const parsed = z.object({
    companyName: z.string().trim().min(2).max(160),
    licenseKey: z.string().trim().max(80).optional(),
    installPassword: z.string().trim().optional(),
    requireDevice: z.boolean(),
    grantFullAccess: z.boolean(),
    deviceId: z.string().trim().max(200).optional(),
    hostName: z.string().trim().max(200).optional(),
    engineerName: z.string().trim().min(2).max(120),
    engineerEmail: z.string().trim().email().max(254),
    role: teamRoleSchema,
    temporaryPassword: z.string().trim().optional(),
  }).safeParse({
    companyName: read(formData, "companyName"),
    licenseKey: read(formData, "licenseKey") || undefined,
    installPassword: read(formData, "installPassword") || undefined,
    requireDevice: checked(formData, "requireDevice"),
    grantFullAccess: checked(formData, "grantFullAccess"),
    deviceId: read(formData, "deviceId") || undefined,
    hostName: read(formData, "hostName") || undefined,
    engineerName: read(formData, "engineerName"),
    engineerEmail: read(formData, "engineerEmail").toLowerCase(),
    role: read(formData, "role"),
    temporaryPassword: read(formData, "temporaryPassword") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the customer details." };

  if (parsed.data.licenseKey && parsed.data.licenseKey.length < 8) return { error: "License keys must be at least 8 characters." };
  if (parsed.data.installPassword && parsed.data.installPassword.length < 10) return { error: "Install passwords must be at least 10 characters." };
  if (parsed.data.temporaryPassword && parsed.data.temporaryPassword.length < 8) return { error: "Temporary passwords must be at least 8 characters." };
  if (Boolean(parsed.data.deviceId) !== Boolean(parsed.data.hostName)) {
    return { error: "Enter both the device ID and host name, or leave both blank until activation." };
  }

  const role = parsed.data.grantFullAccess ? UserRole.ADMIN : (parsed.data.role as UserRole);
  const licenseKey = parsed.data.licenseKey?.toUpperCase() || generatedLicenseKey();
  const installPassword = parsed.data.installPassword || autoPassword();
  const temporaryPassword = parsed.data.temporaryPassword || autoPassword();

  try {
    await prisma.$transaction(async (tx) => {
      const engineer = await tx.user.create({
        data: {
          name: parsed.data.engineerName,
          email: parsed.data.engineerEmail,
          passwordHash: await bcrypt.hash(temporaryPassword, 12),
          roles: [role],
        },
        select: { id: true },
      });
      await tx.customerLicense.create({
        data: {
          companyName: parsed.data.companyName,
          licenseKey,
          installPasswordHash: await bcrypt.hash(installPassword, 12),
          requireDevice: parsed.data.requireDevice,
          grantFullAccess: parsed.data.grantFullAccess,
          deviceId: parsed.data.deviceId ?? null,
          hostName: parsed.data.hostName ?? null,
          engineerName: parsed.data.engineerName,
          engineerEmail: parsed.data.engineerEmail,
          engineerRole: role,
          status: LicenseStatus.PENDING,
          engineerUserId: engineer.id,
          createdById: actor.id,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "The engineer email or license key already exists. Use a different value." };
    }
    throw error;
  }

  revalidatePath("/super-admin");
  revalidatePath("/users");
  return { created: { companyName: parsed.data.companyName, licenseKey, installPassword, temporaryPassword } };
}

export async function setCustomerLicenseStatus(licenseId: string, formData: FormData) {
  await assertCan("manageLicenses", "Only a Super Admin can change license status.");
  const nextStatus = read(formData, "status");
  if (nextStatus !== LicenseStatus.ACTIVE && nextStatus !== LicenseStatus.SUSPENDED) {
    throw new Error("Choose a valid license status.");
  }

  const license = await prisma.customerLicense.findUniqueOrThrow({ where: { id: licenseId } });
  if (nextStatus === LicenseStatus.ACTIVE && license.requireDevice && (!license.deviceId || !license.hostName)) {
    throw new Error("This license needs an approved device ID and host name before activation.");
  }

  await prisma.customerLicense.update({
    where: { id: licenseId },
    data: {
      status: nextStatus,
      ...(nextStatus === LicenseStatus.ACTIVE ? { activatedAt: license.activatedAt ?? new Date() } : {}),
    },
  });
  revalidatePath("/super-admin");
}
