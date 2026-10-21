import { Fragment } from "react";
import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { parseDimensionAndTolerance, computeStatus } from "@/lib/calc/tolerance";

const ROWS_PER_PAGE = 22;

export async function DimensionalReportPrint({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 9 } },
    include: {
      preparedBy: true,
      approvedBy: true,
      ppap: { include: { customer: true, partRevision: { include: { part: true } } } },
      dimensionalReportDetail: {
        include: {
          sampleColumns: { orderBy: { sortOrder: "asc" } },
          rows: { orderBy: { sortOrder: "asc" }, include: { readings: true } },
        },
      },
    },
  });

  if (element.applicability === "NA") {
    return (
      <div className="mx-auto max-w-4xl bg-white p-6 text-black">
        <p className="text-sm">N/A — {element.naReason}</p>
      </div>
    );
  }

  const detail = element.dimensionalReportDetail;
  const rows = detail?.rows ?? [];
  const sampleColumns = detail?.sampleColumns ?? [];
  const part = element.ppap.partRevision.part;

  const pages: (typeof rows)[] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
    pages.push(rows.slice(i, i + ROWS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  return (
    <div className="bg-white text-black">
      <style>{`
        @page { size: A4 landscape; margin: 8mm; }
        @media print {
          .dr-print-page { page-break-after: always; }
          .dr-print-page:last-child { page-break-after: auto; }
        }
      `}</style>

      {pages.map((pageRows, pageIndex) => {
        let lastView: string | null = null;
        return (
          <div key={pageIndex} className="dr-print-page p-4">
            <table className="w-full border-collapse border border-black text-[9px]">
              <tbody>
                <tr>
                  <td className="border border-black p-1" colSpan={5}>
                    Smorx
                  </td>
                  <td className="border border-black p-1" colSpan={sampleColumns.length}>
                    Inspection Report
                  </td>
                  <td className="border border-black p-1" colSpan={2}>
                    Doc No: {element.docNo ?? "-"}
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-1 font-medium">Customer:</td>
                  <td className="border border-black p-1" colSpan={4}>
                    {element.ppap.customer.name}
                  </td>
                  <td className="border border-black p-1 font-medium">Date</td>
                  <td className="border border-black p-1" colSpan={sampleColumns.length - 1}>
                    {detail?.reportDate ? formatDateIndia(detail.reportDate) : "-"}
                  </td>
                  <td className="border border-black p-1" colSpan={2}></td>
                </tr>
                <tr>
                  <td className="border border-black p-1 font-medium">Drawing Number</td>
                  <td className="border border-black p-1" colSpan={4}>
                    {part.partNumber} Rev {element.ppap.partRevision.revision}
                  </td>
                  <td className="border border-black p-1 font-medium">Sl no</td>
                  <td className="border border-black p-1" colSpan={sampleColumns.length - 1}>
                    {detail?.reportSlNo || "-"}
                  </td>
                  <td className="border border-black p-1" colSpan={2}></td>
                </tr>
                <tr>
                  <td className="border border-black p-1 font-medium">Part name:</td>
                  <td className="border border-black p-1" colSpan={4 + sampleColumns.length + 2}>
                    {part.partName}
                  </td>
                </tr>
                <tr className="bg-muted/40">
                  <th className="border border-black p-1">Sl No</th>
                  <th className="border border-black p-1">Parameter Description</th>
                  <th className="border border-black p-1">Dim</th>
                  <th className="border border-black p-1">Tol</th>
                  <th className="border border-black p-1">Instrument Used</th>
                  {sampleColumns.map((c) => (
                    <th key={c.id} className="border border-black p-1">
                      Actual Dimension ({c.label})
                    </th>
                  ))}
                  <th className="border border-black p-1">Status</th>
                  <th className="border border-black p-1">Remarks</th>
                </tr>
              </tbody>
              <tbody>
                {pageRows.map((row) => {
                  const showViewLabel = row.view !== lastView;
                  lastView = row.view;
                  const band = parseDimensionAndTolerance(row.designDimensionText, row.toleranceText);
                  const values = row.readings.map((r) => r.value).filter((v): v is number => v !== null);
                  const anyNg = values.some((v) => computeStatus(v, band) === "NG");
                  const status = values.length === 0 || !band ? "—" : anyNg ? "NG" : "OK";
                  return (
                    <Fragment key={row.id}>
                      {showViewLabel && row.view ? (
                        <tr key={`${row.id}-view`}>
                          <td className="border border-black p-1 text-center font-semibold" colSpan={5 + sampleColumns.length + 2}>
                            {row.view}
                          </td>
                        </tr>
                      ) : null}
                      <tr key={row.id}>
                        <td className="border border-black p-1">{row.slNo}</td>
                        <td className="border border-black p-1">{row.parameterDescription || "-"}</td>
                        <td className="border border-black p-1">{row.designDimensionText || "-"}</td>
                        <td className="border border-black p-1 whitespace-pre-line">{row.toleranceText || "-"}</td>
                        <td className="border border-black p-1">{row.instrumentUsedText || "-"}</td>
                        {sampleColumns.map((c) => {
                          const reading = row.readings.find((r) => r.sampleColumnId === c.id);
                          const cellStatus = computeStatus(reading?.value ?? null, band);
                          return (
                            <td key={c.id} className={`border border-black p-1 text-center ${cellStatus === "NG" ? "bg-red-200 font-semibold" : ""}`}>
                              {reading?.value ?? "-"}
                            </td>
                          );
                        })}
                        <td className={`border border-black p-1 text-center font-medium ${status === "NG" ? "bg-red-200" : ""}`}>{status}</td>
                        <td className="border border-black p-1">{row.remarks || "-"}</td>
                      </tr>
                    </Fragment>
                  );
                })}
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={7 + sampleColumns.length} className="border border-black p-2 text-center">
                      No Dimensional Report rows recorded.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              <tbody>
                <tr>
                  <td className="border border-black p-1 font-medium" colSpan={2}>
                    Inspected By: {element.preparedBy?.name ?? "-"}
                  </td>
                  <td className="border border-black p-1 font-medium" colSpan={2}>
                    Approved By: {element.approvedBy?.name ?? "-"}
                  </td>
                  <td className="border border-black p-1" colSpan={3 + sampleColumns.length}>
                    Page {pageIndex + 1} of {pages.length}
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-1" colSpan={7 + sampleColumns.length}>
                    Comments- {detail?.comments || ""}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
