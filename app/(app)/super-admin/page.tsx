import Link from "next/link";
import { ArrowUpRight, KeyRound, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { SuperAdminWorkspace } from "@/components/super-admin/super-admin-workspace";

export const metadata = { title: "Super Admin" };

export default async function SuperAdminPage() {
  await requirePagePermission("manageLicenses");

  const [teamAccounts, licenses] = await Promise.all([
    prisma.user.findMany({
      where: { passwordHash: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, roles: true, createdAt: true },
    }),
    prisma.customerLicense.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        companyName: true,
        licenseKey: true,
        requireDevice: true,
        grantFullAccess: true,
        deviceId: true,
        hostName: true,
        engineerName: true,
        engineerEmail: true,
        engineerRole: true,
        status: true,
        activatedAt: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-semibold tracking-[0.15em] text-primary uppercase">Administration</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Super Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Provision customer installations, issue licenses, and control team access.</p>
        </div>
        <Link href="/users" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          Detailed role settings <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.88fr_1.12fr]">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10"><Users className="size-5" aria-hidden /></span>
              <div>
                <CardTitle>Manage team accounts</CardTitle>
                <CardDescription className="mt-1">Create logins and give each person an app role.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <SuperAdminWorkspace mode="team" teamAccounts={teamAccounts} licenses={[]} />
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-highlight/20 text-primary ring-1 ring-highlight/30"><KeyRound className="size-5" aria-hidden /></span>
              <div>
                <CardTitle>Add customer / engineer</CardTitle>
                <CardDescription className="mt-1">Create a customer license and its initial engineer login.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <SuperAdminWorkspace mode="license" teamAccounts={[]} licenses={[]} />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
          <div>
            <CardTitle>Licensed customers</CardTitle>
            <CardDescription className="mt-1">License status, approved device, and initial customer account.</CardDescription>
          </div>
          <Badge variant="secondary" className="tabular-nums">{licenses.length}</Badge>
        </CardHeader>
        <CardContent className="pt-5">
          <SuperAdminWorkspace mode="licenses" teamAccounts={[]} licenses={licenses} />
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/60 shadow-none dark:border-blue-900 dark:bg-blue-950/30">
        <CardContent className="flex items-start gap-3 py-4 text-sm text-blue-950 dark:text-blue-100">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p>Install and temporary passwords are shown only once after creation. Copy them into your customer handoff and store them securely.</p>
        </CardContent>
      </Card>
    </main>
  );
}
