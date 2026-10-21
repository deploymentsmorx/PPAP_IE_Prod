import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertCanViewPpap, getCurrentUser } from "@/lib/permissions";
import { getPackManifest, getSubmissionPlan, packFolder } from "@/lib/pack";
import { SubmissionLevelCard } from "@/components/submission-level-card";
import { runConsistencyChecks } from "@/lib/consistency";
import { PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsistencyPanel } from "@/components/consistency-panel";

const btn = "inline-flex h-9 items-center rounded-md border bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90";
const btnOutline = "inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted";

export default async function PpapPackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ppap = await prisma.ppap.findUnique({
    where: { id },
    select: { customerId: true, status: true, elements: { where: { elementNo: 18 }, select: { status: true } } },
  });
  if (!ppap) notFound();
  await assertCanViewPpap(ppap.customerId);
  const [manifest, issues, plan, user] = await Promise.all([getPackManifest(id), runConsistencyChecks(id), getSubmissionPlan(id), getCurrentUser()]);
  const totalAttachments = manifest.included.reduce((n, e) => n + e.attachments.length, 0);
  // Same rule as setSubmissionLevel: the level is printed on the PSW, so it is fixed once the PSW is approved or signed.
  const levelLocked = ppap.status !== "OPEN" || ["APPROVED", "SUBMITTED", "CUSTOMER_APPROVED"].includes(ppap.elements[0]?.status ?? "");
  const supplier = !!user?.can.editSupplierData;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <SubmissionLevelCard
        ppapId={id}
        savedLevel={plan.level}
        savedPicks={plan.picks}
        confirmed={plan.confirmed}
        applicable={manifest.included.map((e) => e.elementNo)}
        editable={supplier && !levelLocked}
        lockedReason={supplier && levelLocked ? "The level is fixed now that the PSW is approved or signed — it is printed on the PSW." : null}
      />

      <Card>
        <CardHeader>
          <CardTitle>Full PPAP pack</CardTitle>
          <p className="text-sm text-muted-foreground">
            One bookmarked PDF in element order — every applicable element&apos;s print view followed by its attachments — and a ZIP with the
            same files in the 4 reference folders of the PPAP document list, plus the full 20-sheet workbook. Rendering takes a minute or two.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <a className={btn} href={`/api/ppap/${id}/pack?format=pdf`} data-testid="pack-pdf" download>
            Download pack PDF
          </a>
          <a className={btnOutline} href={`/api/ppap/${id}/pack?format=zip`} data-testid="pack-zip" download>
            Download ZIP (reference folders)
          </a>
          <a className={btnOutline} href={`/api/ppap/${id}/pack?format=xlsx`} data-testid="pack-xlsx" download>
            Download full workbook (.xlsx)
          </a>
        </CardContent>
      </Card>

      <ConsistencyPanel ppapId={id} issues={issues} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Contents — {manifest.included.length} element(s), {totalAttachments} attachment(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm" data-testid="pack-manifest">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1 pr-2">Element</th>
                <th className="py-1 pr-2">Doc No.</th>
                <th className="py-1 pr-2">Folder</th>
                <th className="py-1">Attachments appended</th>
              </tr>
            </thead>
            <tbody>
              {manifest.included.map((e) => (
                <tr key={e.elementNo} className="border-b align-top" data-testid="pack-row">
                  <td className="py-1 pr-2">
                    <Link className="text-primary hover:underline" href={`/ppap/${id}/${e.elementNo}`}>
                      {e.elementNo}. {e.name}
                    </Link>
                  </td>
                  <td className="py-1 pr-2">{e.docNo ?? "-"}</td>
                  <td className="py-1 pr-2">{packFolder(e.elementNo) ?? "(root)"}</td>
                  <td className="py-1">
                    {e.attachments.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <ul>
                        {e.attachments.map((a) => (
                          <li key={a.url}>
                            {a.source}: {a.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {manifest.excluded.length > 0 && (
            <p className="mt-3 text-sm text-muted-foreground" data-testid="pack-excluded">
              Left out as N/A:{" "}
              {manifest.excluded.map((e) => `${e.elementNo}. ${PPAP_ELEMENT_NAMES[e.elementNo]}${e.reason ? ` (${e.reason})` : ""}`).join("; ")}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
