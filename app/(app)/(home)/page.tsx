import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CircleDot,
  ClipboardCheck,
  Gauge,
  Hourglass,
  Inbox,
  Package,
  Plus,
  Send,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { formatDateIndia } from "@/lib/format";
import { getCurrentUser } from "@/lib/permissions";
import { getDashboard } from "@/lib/dashboard";
import { PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import { CalibrationBadge } from "@/components/calibration-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const STATUS = {
  OPEN: { label: "Open", className: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900" },
  SUBMITTED: { label: "Submitted", className: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900" },
  CLOSED: { label: "Closed", className: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900" },
} as const;

const TONE = {
  neutral: "bg-secondary text-secondary-foreground",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function Kpi({ label, value, icon: Icon, tone, alert, testId }: { label: string; value: number; icon: LucideIcon; tone: keyof typeof TONE; alert?: "warn" | "bad"; testId: string }) {
  const valueClass = alert === "bad" && value > 0 ? "text-red-600 dark:text-red-400" : alert === "warn" && value > 0 ? "text-amber-600 dark:text-amber-400" : "";
  return (
    <div className="flex items-start justify-between gap-2 rounded-xl border border-border/80 bg-card p-4 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]" data-testid={testId}>
      <div className="min-w-0">
        <div className="text-xs leading-snug font-medium text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-2xl font-semibold tracking-tight tabular-nums", valueClass)}>{value}</div>
      </div>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", TONE[tone])}>
        <Icon className="size-4" aria-hidden />
      </span>
    </div>
  );
}

function Section({ title, icon: Icon, count, action, children, className, testId }: { title: string; icon: LucideIcon; count?: number; action?: React.ReactNode; children: React.ReactNode; className?: string; testId?: string }) {
  return (
    <Card className={className} data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="grid size-7 place-items-center rounded-md bg-accent text-primary">
            <Icon className="size-3.5" aria-hidden />
          </span>
          {title}
          {count !== undefined && count > 0 ? <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums">{count}</span> : null}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

// Overdue actions sort first (lib/dashboard.ts), so the top few are the ones that matter.
const FMEA_SHOWN = 6;
const listClass = "-my-1 divide-y text-sm";
const itemClass = "flex flex-wrap items-center gap-x-2 gap-y-1 py-2";

/** Home dashboard (scoped to the viewer — customer logins see only their own PPAPs). */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const d = await getDashboard(user);
  const statusTotals = d.list.reduce((acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }), {} as Record<string, number>);
  const firstName = (user.name ?? user.email).split(/[\s@]/)[0];

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[0.68rem] font-semibold tracking-[0.14em] text-primary/80 uppercase">Workspace overview</p>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {firstName}. {user.can.editSupplierData ? "Here's where every PPAP stands today." : "PPAPs submitted to you for approval."}
          </p>
        </div>
        {user.can.editSupplierData ? (
          <Link href="/ppap/new" className={cn(buttonVariants({ size: "lg" }), "gap-1.5 px-3")}>
            <Plus className="size-4" aria-hidden />
            New PPAP
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Open PPAPs" value={statusTotals.OPEN ?? 0} icon={CircleDot} tone="blue" testId="kpi-open" />
        <Kpi label="Submitted" value={statusTotals.SUBMITTED ?? 0} icon={Send} tone="amber" testId="kpi-submitted" />
        <Kpi label="Closed" value={statusTotals.CLOSED ?? 0} icon={BadgeCheck} tone="green" testId="kpi-closed" />
        <Kpi label={user.can.editSupplierData ? "Customer decisions / signed copies" : "Awaiting your decision"} value={d.decisions.length} icon={Hourglass} tone="amber" alert="warn" testId="kpi-decisions" />
        {d.fmeaActions ? <Kpi label="Open FMEA actions" value={d.fmeaActions.length} icon={ShieldAlert} tone="neutral" alert="warn" testId="kpi-fmea" /> : null}
        {d.calibration ? (
          <Kpi label="Overdue calibrations" value={d.calibration.counts.OVERDUE + d.calibration.counts.NOT_CALIBRATED} icon={Gauge} tone="red" alert="bad" testId="kpi-calibration" />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {user.can.editSupplierData ? (
          <Section testId="pending-mine" title={`Pending my ${user.can.approvePages ? "approval" : "check"}`} icon={ClipboardCheck} count={d.pendingMine.length}>
            {d.pendingMine.length === 0 ? (
              <Empty>Nothing waiting on you.</Empty>
            ) : (
              <ul className={listClass}>
                {d.pendingMine.slice(0, 15).map((p) => (
                  <li key={`${p.ppapId}-${p.elementNo}`} className={itemClass}>
                    <Link href={`/ppap/${p.ppapId}/${p.elementNo}`} className="font-medium text-primary hover:underline">
                      {p.elementNo}. {PPAP_ELEMENT_NAMES[p.elementNo]}
                    </Link>
                    <span className="text-muted-foreground">
                      — {p.partNumber} Rev.{p.revision}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ) : null}

        <Section testId="customer-decisions" title={user.can.editSupplierData ? "Customer decisions" : "Awaiting your decision"} icon={Inbox} count={d.decisions.length}>
          {d.decisions.length === 0 ? (
            <Empty>Nothing outstanding.</Empty>
          ) : (
            <ul className={listClass}>
              {d.decisions.map((x) => (
                <li key={`${x.ppapId}-${x.elementNo}`} className={itemClass}>
                  <Badge variant="outline" className="border-0 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {x.kind === "AWAITING_CUSTOMER" ? "Awaiting customer (portal)" : "Signed copy missing (upload)"}
                  </Badge>
                  <Link href={`/ppap/${x.ppapId}/${x.elementNo}`} className="font-medium text-primary hover:underline">
                    {x.elementNo}. {PPAP_ELEMENT_NAMES[x.elementNo]}
                  </Link>
                  <span className="text-muted-foreground">
                    {x.partNumber} Rev.{x.revision} · {x.customer}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {d.fmeaActions ? (
          <Section testId="fmea-actions" title="Open FMEA actions" icon={ShieldAlert} count={d.fmeaActions.length}>
            {d.fmeaActions.length === 0 ? (
              <Empty>No open recommended actions.</Empty>
            ) : (
              <ul className={listClass}>
                {d.fmeaActions.slice(0, FMEA_SHOWN).map((a) => (
                  <li key={a.id} className={itemClass}>
                    {a.overdue ? <Badge variant="destructive">Overdue</Badge> : null}
                    <Link href={`/ppap/${a.ppapId}/${a.elementNo}`} className="font-medium text-primary hover:underline">
                      {a.fmea} · {a.ppapLabel}
                    </Link>
                    <span className="line-clamp-1 basis-full">{a.what}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.responsible ?? "unassigned"}
                      {a.targetDate ? ` · target ${formatDateIndia(a.targetDate)}` : ""}
                    </span>
                  </li>
                ))}
                {d.fmeaActions.length > FMEA_SHOWN ? <li className="py-2 text-muted-foreground">…and {d.fmeaActions.length - FMEA_SHOWN} more</li> : null}
              </ul>
            )}
          </Section>
        ) : null}

        {d.calibration && d.calibration.attention.length > 0 ? (
          <Section
            testId="calibration-widget"
            title="Instrument calibration"
            icon={Gauge}
            action={
              <Link href="/instruments" className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:underline">
                Instrument master <ArrowRight className="size-3" aria-hidden />
              </Link>
            }
          >
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <CalibrationBadge status="OVERDUE" /> {d.calibration.counts.OVERDUE}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalibrationBadge status="NOT_CALIBRATED" /> {d.calibration.counts.NOT_CALIBRATED}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalibrationBadge status="DUE_SOON" /> {d.calibration.counts.DUE_SOON}
              </span>
            </div>
            <ul className={cn(listClass, "border-t")}>
              {d.calibration.attention.map((i) => (
                <li key={i.id} className={itemClass}>
                  <CalibrationBadge status={i.status} />
                  <span className="font-medium">{i.ieIdNo ?? `#${i.slNo}`}</span>
                  <span>{i.description}</span>
                  <span className="text-muted-foreground">{i.calibrationDue ? `due ${formatDateIndia(i.calibrationDue)}` : "no calibration record"}</span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {d.masterSamples && d.masterSamples.length > 0 ? (
          <Section testId="master-sample-reminders" title="Master samples expiring" icon={Package} count={d.masterSamples.length} className="ring-amber-300/70 dark:ring-amber-800">
            <ul className={listClass}>
              {d.masterSamples.map((m) => (
                <li key={m.id} className={itemClass}>
                  <Badge
                    variant={m.state === "EXPIRED" ? "destructive" : "outline"}
                    className={m.state === "EXPIRED" ? undefined : "border-0 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}
                  >
                    {m.state === "EXPIRED" ? `Expired ${formatDateIndia(m.expiry)}` : `Expires in ${m.days} day(s) — ${formatDateIndia(m.expiry)}`}
                  </Badge>
                  <Link href={`/ppap/${m.ppapId}/15`} className="font-medium hover:underline">
                    {m.sampleId}
                  </Link>
                  <span className="text-muted-foreground">
                    {m.partName} · {m.partNumber} Rev.{m.revision}
                    {m.storageLocation ? ` · ${m.storageLocation}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section testId="by-customer" title="PPAPs by customer" icon={Building2} count={d.byCustomer.length}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="py-2 pr-2 font-medium">Customer</th>
                <th className="px-2 py-2 text-right font-medium">Open</th>
                <th className="px-2 py-2 text-right font-medium">Submitted</th>
                <th className="py-2 pl-2 text-right font-medium">Closed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {d.byCustomer.map((c) => (
                <tr key={c.customer}>
                  <td className="py-2 pr-2 font-medium">{c.customer}</td>
                  <td className="px-2 py-2 text-right">{c.OPEN || <span className="text-muted-foreground">0</span>}</td>
                  <td className="px-2 py-2 text-right">{c.SUBMITTED || <span className="text-muted-foreground">0</span>}</td>
                  <td className="py-2 pl-2 text-right">{c.CLOSED || <span className="text-muted-foreground">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b py-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ClipboardCheck className="size-4 text-muted-foreground" aria-hidden />
            PPAP Submissions
            <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums">{d.list.length}</span>
          </CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Part</TableHead>
              <TableHead>Part No / Rev</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-56 pr-4">Complete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.list.map((p) => (
              <TableRow key={p.id} data-testid="ppap-row" className="group">
                <TableCell className="py-3 pl-4">
                  <Link href={`/ppap/${p.id}`} className="font-medium group-hover:text-primary hover:underline">
                    {p.partName}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">
                  {p.partNumber} Rev.{p.revision}
                </TableCell>
                <TableCell>{p.customer}</TableCell>
                <TableCell>
                  <Badge variant="secondary">Level {p.level}</Badge>
                </TableCell>
                <TableCell>
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", STATUS[p.status].className)}>{STATUS[p.status].label}</span>
                  {p.status === "OPEN" && p.readyToSign ? <span className="ml-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">ready to sign</span> : null}
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", p.pctComplete === 100 ? "bg-emerald-500" : "bg-primary")}
                        style={{ width: `${p.pctComplete}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{p.pctComplete}%</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {d.list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No PPAPs yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </main>
  );
}
