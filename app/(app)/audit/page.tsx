import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/permissions";
import { auditDiff } from "@/lib/calc/audit-diff";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 100;

function fmt(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  // DD-MM-YYYY HH:MM, shown in IST (UTC+5:30).
  const ist = new Date(d.getTime() + 330 * 60_000);
  return `${p(ist.getUTCDate())}-${p(ist.getUTCMonth() + 1)}-${ist.getUTCFullYear()} ${p(ist.getUTCHours())}:${p(ist.getUTCMinutes())}`;
}

/** Audit-log viewer (QA Manager / Admin): every create / update / approve / revise / delete with its field-level diff. */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ ppap?: string; entity?: string; user?: string; action?: string; from?: string; to?: string; page?: string }>;
}) {
  await requirePagePermission("viewAuditLog");
  const q = await searchParams;
  const page = Math.max(1, Number(q.page) || 1);
  const where = {
    ...(q.ppap ? { ppapId: q.ppap } : {}),
    ...(q.entity ? { entityType: q.entity } : {}),
    ...(q.user ? { userId: q.user } : {}),
    ...(q.action ? { action: q.action as never } : {}),
    ...(q.from || q.to
      ? { createdAt: { ...(q.from ? { gte: new Date(`${q.from}T00:00:00.000Z`) } : {}), ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999Z`) } : {}) } }
      : {}),
  };

  const [rows, total, entityTypes, users, ppaps] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { user: { select: { name: true } }, ppap: { select: { id: true, partRevision: { select: { revision: true, part: { select: { partNumber: true } } } } } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.ppap.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, partRevision: { select: { revision: true, part: { select: { partNumber: true } } } } } }),
  ]);
  const selectClass = "h-9 rounded-md border bg-transparent px-2 text-sm";
  const pageLink = (n: number) => `/audit?${new URLSearchParams({ ...Object.fromEntries(Object.entries(q).filter(([, v]) => v)), page: String(n) } as Record<string, string>)}`;

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
          <form className="flex flex-wrap items-end gap-2 text-sm" method="get">
            <select name="ppap" defaultValue={q.ppap ?? ""} aria-label="PPAP" className={selectClass}>
              <option value="">All PPAPs</option>
              {ppaps.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.partRevision.part.partNumber} Rev.{p.partRevision.revision}
                </option>
              ))}
            </select>
            <select name="entity" defaultValue={q.entity ?? ""} aria-label="Record type" className={selectClass}>
              <option value="">All record types</option>
              {entityTypes.map((e) => (
                <option key={e.entityType} value={e.entityType}>
                  {e.entityType}
                </option>
              ))}
            </select>
            <select name="action" defaultValue={q.action ?? ""} aria-label="Action" className={selectClass}>
              <option value="">All actions</option>
              {["CREATE", "UPDATE", "APPROVE", "REVISE", "DELETE"].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select name="user" defaultValue={q.user ?? ""} aria-label="User" className={selectClass}>
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1">
              From <input type="date" name="from" defaultValue={q.from ?? ""} className={selectClass} />
            </label>
            <label className="flex items-center gap-1">
              To <input type="date" name="to" defaultValue={q.to ?? ""} className={selectClass} />
            </label>
            <Button type="submit" size="sm">
              Filter
            </Button>
            <Link href="/audit" className="text-muted-foreground hover:underline">
              Reset
            </Link>
          </form>
          <p className="text-xs text-muted-foreground" data-testid="audit-total">
            {total} entr{total === 1 ? "y" : "ies"} — newest first
          </p>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="p-1">When (IST)</th>
                <th className="p-1">User</th>
                <th className="p-1">Action</th>
                <th className="p-1">Record</th>
                <th className="p-1">PPAP</th>
                <th className="p-1">Changes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const changes = auditDiff(r.before, r.after);
                return (
                  <tr key={r.id} className="border-b align-top" data-testid="audit-row">
                    <td className="whitespace-nowrap p-1">{fmt(r.createdAt)}</td>
                    <td className="p-1">{r.user?.name ?? "—"}</td>
                    <td className="p-1">
                      <Badge variant={r.action === "DELETE" ? "destructive" : "outline"}>{r.action}</Badge>
                    </td>
                    <td className="p-1">{r.entityType}</td>
                    <td className="p-1">
                      {r.ppap ? (
                        <Link href={`/ppap/${r.ppap.id}`} className="text-primary hover:underline">
                          {r.ppap.partRevision.part.partNumber} Rev.{r.ppap.partRevision.revision}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">master data</span>
                      )}
                    </td>
                    <td className="p-1">
                      {changes.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <details>
                          <summary className="cursor-pointer text-xs">
                            {changes.length} field(s): {changes.slice(0, 3).map((c) => c.field).join(", ")}
                            {changes.length > 3 ? "…" : ""}
                          </summary>
                          <table className="mt-1 text-xs">
                            <tbody>
                              {changes.map((c) => (
                                <tr key={c.field}>
                                  <td className="pr-2 font-medium">{c.field}</td>
                                  <td className="max-w-xs break-all pr-2 text-red-700 line-through dark:text-red-400">{c.before}</td>
                                  <td className="max-w-xs break-all text-emerald-700 dark:text-emerald-400">{c.after}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-3 text-sm">
            {page > 1 ? <Link href={pageLink(page - 1)} className="text-primary hover:underline">← Newer</Link> : null}
            <span className="text-muted-foreground">
              Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
            </span>
            {page * PAGE_SIZE < total ? <Link href={pageLink(page + 1)} className="text-primary hover:underline">Older →</Link> : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
