import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { permissionsFor } from "@/lib/calc/permissions";
import { UserRole } from "@/app/generated/prisma/client";

/** The signed-in user with roles and the permissions they imply (lib/calc/permissions.ts). */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, roles: true, customerId: true } });
  if (!user) return null;
  const superAdminEmails = new Set((process.env.SUPER_ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
  const roles = superAdminEmails.has(user.email.toLowerCase())
    ? Array.from(new Set([...user.roles, UserRole.SUPER_ADMIN]))
    : user.roles;
  return { ...user, roles, can: permissionsFor(roles) };
}

/** Server-action guard: only supplier users may change supplier data (customer approvers are read-only). */
export async function assertSupplierUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.can.editSupplierData) throw new Error("Customer logins are read-only here — only the customer disposition can be recorded.");
  return user;
}

/** Server-action guard for a specific permission. */
export async function assertCan(permission: keyof ReturnType<typeof permissionsFor>, message: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!user.can[permission]) throw new Error(message);
  return user;
}

/** Page guard: a customer-only login may open only its own customer's PPAPs. */
export async function assertCanViewPpap(ppapCustomerId: string) {
  const user = await getCurrentUser();
  if (user?.can.ownCustomerOnly && user.customerId !== ppapCustomerId) notFound();
}

/** Page guard for supplier-only pages (masters, users, audit). */
export async function requirePagePermission(permission: keyof ReturnType<typeof permissionsFor>) {
  const user = await getCurrentUser();
  if (!user?.can[permission]) notFound();
  return user;
}
