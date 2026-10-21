import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { calibrationStatus, isInstrumentPickable } from "@/lib/calc/calibration";
import { getCheckingAidsForPpap, getDueSoonDays } from "@/lib/instruments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { SignatureBlock } from "@/components/signature-block";
import { NaToggle } from "@/components/na-toggle";
import { CalibrationBadge } from "@/components/calibration-badge";
import { CheckingAidsAdd, CheckingAidRemove } from "@/components/ppap-pages/checking-aids-manual";
import { FIXTURE_TYPE_LABEL, FIXTURE_STATUS_LABEL } from "@/lib/constants/fixtures";

/**
 * Element 16 for one PPAP: the instruments/fixtures this part uses —
 * auto-collected from Control Plan, Dimensional, MSA and SPC, fixtures
 * linked to the part, plus manual additions. The master list itself is
 * global (/instruments).
 */
export async function CheckingAidsPage({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({ where: { ppapId_elementNo: { ppapId, elementNo: 16 } } });
  const [aids, dueSoonDays, users, allInstruments, allFixtures] = await Promise.all([
    getCheckingAidsForPpap(ppapId),
    getDueSoonDays(),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.instrument.findMany({ orderBy: [{ slNo: "asc" }, { description: "asc" }] }),
    prisma.fixture.findMany({ where: { status: { not: "RETIRED" } }, orderBy: { code: "asc" } }),
  ]);
  const locked = element.status === "APPROVED";
  const isNa = element.applicability === "NA";
  const today = new Date();
  const listedInstrumentIds = new Set(aids.instruments.map((i) => i.id));
  const listedFixtureIds = new Set(aids.fixtures.map((f) => f.id));

  return (
    <main className="mx-auto max-w-[96rem] space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>16. Checking Aids</CardTitle>
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={element.applicability} />
            <StatusBadge status={element.status} />
            <Button render={<Link href="/instruments" />} nativeButton={false} variant="outline" size="sm">
              Instrument master
            </Button>
            <Button render={<Link href={`/ppap/${ppapId}/16/print`} target="_blank" />} nativeButton={false} variant="outline" size="sm">
              Print
            </Button>
            <Button render={<a href={`/api/ppap/${ppapId}/16/pdf`} />} nativeButton={false} variant="outline" size="sm">
              Download PDF
            </Button>
            <Button render={<a href={`/api/checking-aids/${element.id}/export`} />} nativeButton={false} variant="outline" size="sm">
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <NaToggle
            ppapElementId={element.id}
            label="Checking aids not required for this submission (N/A)"
            defaultReason="Not required per PPAP checklist"
            initialEnabled={isNa}
            initialReason={element.naReason ?? ""}
            locked={locked}
          />

          {isNa ? (
            <p className="rounded bg-muted px-3 py-2 text-sm text-muted-foreground">N/A — {element.naReason}</p>
          ) : (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Measuring instruments used by this part</h3>
                <p className="text-xs text-muted-foreground">
                  Collected automatically from 7. Control Plan, 8. MSA, 9. Dimensional Results and 11. SPC, plus any added here.
                  &ldquo;Due soon&rdquo; = within {dueSoonDays} days.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[72rem] text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="p-1">Sl.</th>
                        <th className="p-1">Description</th>
                        <th className="p-1">Range</th>
                        <th className="p-1">Serial No.</th>
                        <th className="p-1">IE ID No.</th>
                        <th className="p-1">Make</th>
                        <th className="p-1">Calibrated on</th>
                        <th className="p-1">Calibration due</th>
                        <th className="p-1">Location</th>
                        <th className="p-1">Status</th>
                        <th className="p-1">Used in</th>
                        {!locked ? <th className="w-10 p-1" /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {aids.instruments.map((i, idx) => (
                        <tr key={i.id} className="border-b" data-testid={`aid-${i.ieIdNo ?? i.slNo}`}>
                          <td className="p-1">{idx + 1}</td>
                          <td className="p-1">{i.description}</td>
                          <td className="p-1">{i.range ?? "—"}</td>
                          <td className="p-1">{i.serialNo ?? "—"}</td>
                          <td className="p-1">{i.ieIdNo ?? "—"}</td>
                          <td className="p-1">{i.make ?? "—"}</td>
                          <td className="p-1">{formatDateIndia(i.calibratedOn)}</td>
                          <td className="p-1">{formatDateIndia(i.calibrationDue)}</td>
                          <td className="p-1">{i.location ?? "—"}</td>
                          <td className="p-1">
                            <CalibrationBadge status={calibrationStatus(i.calibrationDue, today, dueSoonDays)} />
                          </td>
                          <td className="p-1 text-xs">{i.usedIn.join(", ")}</td>
                          {!locked ? (
                            <td className="p-1">
                              {i.usedIn.includes("Added manually") ? <CheckingAidRemove ppapElementId={element.id} instrumentId={i.id} label={i.description} /> : null}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                      {aids.instruments.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="p-1 text-muted-foreground">
                            No instruments referenced yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Checking fixtures, templates &amp; jigs</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="p-1">Code</th>
                      <th className="p-1">Description</th>
                      <th className="p-1">Type</th>
                      <th className="p-1">Drawing</th>
                      <th className="p-1">Validated on</th>
                      <th className="p-1">Status</th>
                      <th className="p-1">Source</th>
                      {!locked ? <th className="w-10 p-1" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {aids.fixtures.map((f) => (
                      <tr key={f.id} className="border-b">
                        <td className="p-1 font-medium">{f.code}</td>
                        <td className="p-1">{f.description}</td>
                        <td className="p-1">{FIXTURE_TYPE_LABEL[f.type]}</td>
                        <td className="p-1">
                          {f.drawingNo ?? ""}{" "}
                          {f.drawingFileUrl ? (
                            <a href={f.drawingFileUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                              file
                            </a>
                          ) : null}
                        </td>
                        <td className="p-1">
                          {formatDateIndia(f.validationDate)}{" "}
                          {f.validationRecordUrl ? (
                            <a href={f.validationRecordUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                              record
                            </a>
                          ) : null}
                        </td>
                        <td className="p-1">{FIXTURE_STATUS_LABEL[f.status]}</td>
                        <td className="p-1 text-xs">{[f.linkedToPart ? "Linked to part" : null, f.addedManually ? "Added manually" : null].filter(Boolean).join(", ")}</td>
                        {!locked ? (
                          <td className="p-1">{f.addedManually ? <CheckingAidRemove ppapElementId={element.id} fixtureId={f.id} label={f.code} /> : null}</td>
                        ) : null}
                      </tr>
                    ))}
                    {aids.fixtures.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-1 text-muted-foreground">
                          No fixtures for this part. Register them on the Instrument master page.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </section>

              {!locked ? (
                <CheckingAidsAdd
                  ppapElementId={element.id}
                  instruments={allInstruments
                    .filter((i) => !listedInstrumentIds.has(i.id))
                    .map((i) => ({ id: i.id, label: `${i.ieIdNo ?? `#${i.slNo}`} — ${i.description}${i.range ? ` (${i.range})` : ""}`, pickable: isInstrumentPickable(i.calibrationDue) }))}
                  fixtures={allFixtures.filter((f) => !listedFixtureIds.has(f.id)).map((f) => ({ id: f.id, label: `${f.code} — ${f.description}` }))}
                />
              ) : null}
            </>
          )}

          <SignatureBlock
            ppapElementId={element.id}
            stages={["PREPARED", "CHECKED", "APPROVED"]}
            status={element.status}
            users={users}
            prepared={{ byId: element.preparedById, at: element.preparedAt }}
            checked={{ byId: element.checkedById, at: element.checkedAt }}
            approved={{ byId: element.approvedById, at: element.approvedAt }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
