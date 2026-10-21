import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/permissions";
import { formatDateIndia } from "@/lib/format";
import { calibrationStatus, type CalibrationStatus } from "@/lib/calc/calibration";
import { getDueSoonDays } from "@/lib/instruments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalibrationBadge } from "@/components/calibration-badge";
import { InstrumentForm } from "@/components/instruments/instrument-form";
import { InstrumentRowActions } from "@/components/instruments/instrument-row";
import { CalibrationSettings } from "@/components/instruments/calibration-settings";
import { FixtureForm, FixtureEditToggle } from "@/components/instruments/fixture-form";
import { FIXTURE_TYPE_LABEL, FIXTURE_STATUS_LABEL } from "@/lib/constants/fixtures";

const STATUS_ORDER: CalibrationStatus[] = ["OVERDUE", "NOT_CALIBRATED", "DUE_SOON", "VALID"];

/** Global instrument master + fixture register ("16. Checking Aids"). */
export default async function InstrumentsPage() {
  await requirePagePermission("editSupplierData");
  const [dueSoonDays, instruments, fixtures, parts] = await Promise.all([
    getDueSoonDays(),
    prisma.instrument.findMany({
      orderBy: [{ slNo: "asc" }, { description: "asc" }],
      include: { calibrationRecords: { orderBy: { calibratedOn: "desc" }, include: { recordedBy: { select: { name: true } } } } },
    }),
    prisma.fixture.findMany({ orderBy: { code: "asc" }, include: { part: true } }),
    prisma.part.findMany({ orderBy: { partName: "asc" }, select: { id: true, partName: true, partNumber: true } }),
  ]);
  const partOptions = parts.map((p) => ({ id: p.id, label: `${p.partName} (${p.partNumber})` }));
  const today = new Date();
  const withStatus = instruments.map((i) => ({ ...i, status: calibrationStatus(i.calibrationDue, today, dueSoonDays) }));
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, withStatus.filter((i) => i.status === s).length])) as Record<CalibrationStatus, number>;

  return (
    <main className="mx-auto max-w-[96rem] space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Measuring Instruments — Master List</CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {STATUS_ORDER.map((s) => (
              <span key={s} className="flex items-center gap-1" data-testid={`count-${s}`}>
                <CalibrationBadge status={s} /> {counts[s]}
              </span>
            ))}
            <span className="text-muted-foreground">— status is recomputed every time this page loads.</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CalibrationSettings dueSoonDays={dueSoonDays} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[80rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-1">Sl.</th>
                  <th className="p-1">Description</th>
                  <th className="p-1">Range</th>
                  <th className="p-1">Serial No.</th>
                  <th className="p-1">IE ID No.</th>
                  <th className="p-1">Make</th>
                  <th className="p-1">Least count</th>
                  <th className="p-1">Frequency</th>
                  <th className="p-1">Calibrated on</th>
                  <th className="p-1">Calibration due</th>
                  <th className="p-1">Location</th>
                  <th className="p-1">Status</th>
                  <th className="p-1">Remarks</th>
                  <th className="p-1" />
                </tr>
              </thead>
              <tbody>
                {withStatus.map((i) => (
                  <InstrumentRowActions
                    key={i.id}
                    colSpan={14}
                    badge={<CalibrationBadge status={i.status} />}
                    instrument={i}
                    history={i.calibrationRecords.map((r) => ({ ...r, recordedByName: r.recordedBy?.name ?? null }))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Instrument</CardTitle>
        </CardHeader>
        <CardContent>
          <InstrumentForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Checking Fixtures, Templates &amp; Jigs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-1">Code</th>
                  <th className="p-1">Description</th>
                  <th className="p-1">Type</th>
                  <th className="p-1">Part</th>
                  <th className="p-1">Drawing</th>
                  <th className="p-1">Validation</th>
                  <th className="p-1">Status</th>
                  <th className="p-1">Location</th>
                  <th className="p-1" />
                </tr>
              </thead>
              <tbody>
                {fixtures.map((f) => (
                  <tr key={f.id} className="border-b align-top">
                    <td className="p-1 font-medium">{f.code}</td>
                    <td className="p-1">{f.description}</td>
                    <td className="p-1">{FIXTURE_TYPE_LABEL[f.type]}</td>
                    <td className="p-1">{f.part ? `${f.part.partName} (${f.part.partNumber})` : "—"}</td>
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
                    <td className="p-1">{f.location ?? "—"}</td>
                    <td className="p-1">
                      <FixtureEditToggle fixture={f} parts={partOptions} />
                    </td>
                  </tr>
                ))}
                {fixtures.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-1 text-muted-foreground">
                      No fixtures registered yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="rounded-md border p-3">
            <h3 className="mb-2 text-sm font-semibold">Add fixture</h3>
            <FixtureForm parts={partOptions} />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
