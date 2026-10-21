import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

/**
 * E2E fixture: a CUSTOMER_APPROVER login for an E2E customer, so the
 * customer-portal approval mode can be exercised end to end (portal-mode
 * dispositions can only be recorded by that customer's approver).
 * Usage: tsx scripts/create-e2e-approver.ts "<customer name>" <email>
 * Removed by scripts/cleanup-e2e.ts (emails starting "e2e-").
 */
async function main() {
  const [customerName, email] = process.argv.slice(2);
  if (!customerName || !email?.startsWith("e2e-")) throw new Error('Usage: create-e2e-approver.ts "<E2E customer>" e2e-<...>@<domain>');
  const customer = await prisma.customer.findFirstOrThrow({ where: { name: customerName } });
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  await prisma.user.upsert({
    where: { email },
    update: { roles: ["CUSTOMER_APPROVER"], customerId: customer.id, passwordHash },
    create: { email, name: "E2E Customer Approver", designation: "Customer SQE", roles: ["CUSTOMER_APPROVER"], customerId: customer.id, passwordHash },
  });
  console.log(`Approver ${email} for ${customerName}`);
}

main().finally(() => prisma.$disconnect());
