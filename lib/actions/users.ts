"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSupplierUser, assertCan } from "@/lib/permissions";
import { Prisma, UserRole } from "@/app/generated/prisma/client";

const USER_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.QA_ENGINEER, UserRole.QA_MANAGER, UserRole.ENGINEERING, UserRole.LEAD, UserRole.PRODUCTION, UserRole.CUSTOMER_APPROVER];

const createPersonSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  designation: z.string().optional(),
});

function parseRoles(formData: FormData): UserRole[] {
  return formData
    .getAll("roles")
    .map((v) => String(v))
    .filter((v): v is UserRole => USER_ROLES.includes(v as UserRole));
}

/**
 * Adds a person who can be selected as a Prepared/Checked/Approved signer
 * (and appear in other pickers like Control Plan's core team). No password
 * is set — they become selectable immediately; a login can be granted
 * later (set a password or send a magic link) if they need one.
 *
 * roles/customerId are optional — the quick-add used from signature
 * pickers doesn't send them, since those are always supplier-side
 * signers. Assign CUSTOMER_APPROVER + a customer from the /users page to
 * let that person act as a customer-portal approver.
 */
export async function createPerson(formData: FormData) {
  // Any supplier user may quick-add a signer from a picker; roles/customer
  // (and so customer logins) are only assignable by an admin.
  const actor = await assertSupplierUser();
  const data = createPersonSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    designation: formData.get("designation") || undefined,
  });
  const roles = parseRoles(formData);
  const customerId = (formData.get("customerId") as string | null) || null;
  if ((roles.length > 0 || customerId) && !actor.can.manageUsers) {
    throw new Error("Only an admin can assign roles or a customer.");
  }

  try {
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, designation: data.designation, roles, customerId },
      select: { id: true, name: true },
    });
    revalidatePath("/users");
    return user;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("A user with that email already exists.");
    }
    throw err;
  }
}

export async function updatePersonRolesAndCustomer(userId: string, formData: FormData) {
  await assertCan("manageUsers", "Only an admin can change roles.");
  const roles = parseRoles(formData);
  const customerId = (formData.get("customerId") as string | null) || null;

  await prisma.user.update({ where: { id: userId }, data: { roles, customerId } });
  revalidatePath("/users");
}
