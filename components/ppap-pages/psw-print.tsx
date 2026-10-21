import { getPswView } from "@/lib/psw";
import { PSW_REASONS, PSW_LEVELS, pswDeclaration, type ResultTick } from "@/lib/calc/psw";
import { formatDateIndia } from "@/lib/format";

const cell = "border border-black px-1 py-0.5 align-top";
const label = "text-[9px] text-gray-700";
const box = (on: boolean) => (on ? "☑" : "☐");
const tick = (v: ResultTick) => (v === "YES" ? "☑" : v === "NA" ? "N/A" : "☐");

/** AIAG Part Submission Warrant, as the reference sheet "18. PSW" (portrait). */
export async function PswPrint({ ppapId }: { ppapId: string }) {
  const v = await getPswView(ppapId);
  const d = v.detail;
  const reasons = new Set(v.defaults.reasons);
  const cd = v.disposition;

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 text-[11px] text-black print:p-0">
      <style>{`@page { size: A4 portrait; margin: 10mm; }`}</style>
      <h1 className="border border-black py-1 text-center text-base font-bold">Part Submission Warrant (PSW)</h1>

      <table className="w-full border-collapse border border-black">
        <tbody>
          <tr>
            <td className={cell} colSpan={2}>
              <div className={label}>Part Name</div>
              {v.partInfo.partName}
            </td>
            <td className={cell} colSpan={2}>
              <div className={label}>Part Number</div>
              {v.partInfo.customerPartNumber}
            </td>
          </tr>
          <tr>
            <td className={cell} colSpan={2}>
              <div className={label}>Safety and/or Government Regulation</div>
              {box(d?.safetyGovRegulation === true)} Yes &nbsp; {box(d?.safetyGovRegulation === false)} No
            </td>
            <td className={cell}>
              <div className={label}>Engineering Drawing Change Level</div>
              {v.partInfo.ecl}
            </td>
            <td className={cell}>
              <div className={label}>Dated</div>
              {formatDateIndia(v.partInfo.eclDate)}
            </td>
          </tr>
          <tr>
            <td className={cell} colSpan={3}>
              <div className={label}>Additional Engineering Changes</div>
              {v.partInfo.additionalChanges.length ? v.partInfo.additionalChanges.map((c) => c.ecnNumber).join(", ") : "-"}
            </td>
            <td className={cell}>
              <div className={label}>Dated</div>
              {v.partInfo.additionalChanges.length ? v.partInfo.additionalChanges.map((c) => formatDateIndia(c.ecnDate)).join(", ") : "-"}
            </td>
          </tr>
          <tr>
            <td className={cell}>
              <div className={label}>Shown on Drawing Number</div>
              {v.partInfo.drawingNo}
            </td>
            <td className={cell} colSpan={2}>
              <div className={label}>Purchase Order No.</div>
              {d?.poNumber ?? ""}
            </td>
            <td className={cell}>
              <div className={label}>Weight (kg)</div>
              {v.partInfo.weightKg != null ? `${v.partInfo.weightKg}Kgs` : ""}
            </td>
          </tr>
          <tr>
            <td className={cell}>
              <div className={label}>Checking Aid Number</div>
              {v.defaults.checkingAidNo ?? "-"}
            </td>
            <td className={cell} colSpan={2}>
              <div className={label}>Engineering Change Level</div>
              {d?.checkingAidEcl ?? ""}
            </td>
            <td className={cell}>
              <div className={label}>Dated</div>
              {d?.checkingAidEclDate ? formatDateIndia(d.checkingAidEclDate) : ""}
            </td>
          </tr>
          <tr>
            <td className={`${cell} font-semibold`} colSpan={2}>
              SUPPLIER MANUFACTURING INFORMATION
            </td>
            <td className={`${cell} font-semibold`} colSpan={2}>
              SUBMISSION INFORMATION
            </td>
          </tr>
          <tr>
            <td className={cell} colSpan={2} rowSpan={2}>
              <div className={label}>Supplier Name &amp; Supplier Code</div>
              {v.supplierInfo.name.toUpperCase()}
              {v.supplierInfo.code ? ` — ${v.supplierInfo.code}` : ""}
              <div className={`${label} mt-1`}>Street Address</div>
              {v.supplierInfo.street}
              <div className="mt-1 grid grid-cols-3 gap-1">
                <div>
                  <div className={label}>City</div>
                  {v.supplierInfo.city}
                </div>
                <div>
                  <div className={label}>State/Country</div>
                  {v.supplierInfo.stateCountry}
                </div>
                <div>
                  <div className={label}>Zip/Postal Code</div>
                  {v.supplierInfo.zip}
                </div>
              </div>
            </td>
            <td className={cell} colSpan={2}>
              {box(d?.submittalDimensional ?? true)} Dimensional &nbsp; {box(d?.submittalMaterials ?? true)} Materials/Function &nbsp;{" "}
              {box(d?.submittalAppearance ?? true)} Appearance
              <div className={`${label} mt-1`}>Customer Name/Division</div>
              {v.submissionInfo.customerDivision}
            </td>
          </tr>
          <tr>
            <td className={cell} colSpan={2}>
              <div className={label}>Buyer/Buyer Code</div>
              {v.submissionInfo.buyer ?? "-"}
              <div className={`${label} mt-1`}>Application</div>
              {v.submissionInfo.application ?? ""}
            </td>
          </tr>
          <tr>
            <td className={cell} colSpan={4}>
              <div className="font-semibold">REASON FOR SUBMISSION</div>
              <div className="grid grid-cols-2 gap-x-4">
                {[0, 5, 1, 6, 2, 7, 3, 8, 4].map((i) => (
                  <div key={PSW_REASONS[i].code}>
                    {box(reasons.has(PSW_REASONS[i].code))} {PSW_REASONS[i].label}
                    {PSW_REASONS[i].code === "OTHER" && d?.otherReasonText ? `: ${d.otherReasonText}` : ""}
                  </div>
                ))}
              </div>
            </td>
          </tr>
          <tr>
            <td className={cell} colSpan={4}>
              <div className="font-semibold">REQUESTED SUBMISSION LEVEL (Check one)</div>
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n}>
                  {box(n === v.level)} {PSW_LEVELS[n]}
                </div>
              ))}
            </td>
          </tr>
          <tr>
            <td className={cell} colSpan={4}>
              <div className="font-semibold">SUBMISSION RESULTS</div>
              <div>
                The results for {tick(v.results.dimensional)} dimensional measurements {tick(v.results.materialFunctional)} material and functional tests{" "}
                {tick(v.results.appearance)} appearance criteria {tick(v.results.statistical)} statistical process package
              </div>
              <div>
                These results meet all drawing and specification requirements: {box(d?.resultsMeetRequirements === true)} YES{" "}
                {box(d?.resultsMeetRequirements === false)} NO (If &quot;NO&quot; - Explanation Required)
              </div>
            </td>
          </tr>
          <tr>
            <td className={cell} colSpan={4}>
              <div className="font-semibold">DECLARATION</div>
              <p>{pswDeclaration(d?.productionRateQty ?? null, d?.productionRateHours ?? null)}</p>
              <div className="mt-1">
                <span className="font-semibold">EXPLANATION/COMMENTS:</span> {d?.explanation || "-"}
              </div>
            </td>
          </tr>
          <tr>
            <td className={cell}>
              <div className={label}>Print Name</div>
              {d?.printName ?? ""}
            </td>
            <td className={cell}>
              <div className={label}>Title</div>
              {d?.title ?? ""}
            </td>
            <td className={cell} colSpan={2}>
              <div className={label}>Phone No.</div>
              {d?.phone ?? ""}
            </td>
          </tr>
          <tr>
            <td className={cell} colSpan={3}>
              <div className={label}>Supplier Authorized Signature</div>
              <div className="flex h-10 items-center gap-2">
                {d?.signedBy?.signatureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.signedBy.signatureUrl} alt="Signature" className="h-9" />
                ) : null}
                {d?.signedAt ? <span className="italic">e-signed by {d.signedBy?.name}</span> : null}
              </div>
            </td>
            <td className={cell}>
              <div className={label}>Date</div>
              {d?.signedAt ? formatDateIndia(d.signedAt) : ""}
            </td>
          </tr>
          <tr>
            <td className={`${cell} bg-gray-100 text-center font-semibold`} colSpan={4}>
              FOR CUSTOMER USE ONLY
            </td>
          </tr>
          <tr>
            <td className={cell} colSpan={4}>
              Part Disposition: {box(cd?.status === "APPROVED")} Approved &nbsp; {box(cd?.status === "REJECTED")} Rejected &nbsp; {box(cd?.status === "CONDITIONAL")} Other
              {cd?.comments ? <div className="mt-1">Comments: {cd.comments}</div> : null}
            </td>
          </tr>
          <tr>
            <td className={cell}>
              <div className={label}>Customer Name</div>
              {[cd?.customerName, cd?.customerDesignation].filter(Boolean).join(", ")}
            </td>
            <td className={cell} colSpan={2}>
              <div className={label}>Customer Signature</div>
              <div className="h-8" />
            </td>
            <td className={cell}>
              <div className={label}>Date</div>
              {cd?.customerSignatureDate ? formatDateIndia(cd.customerSignatureDate) : ""}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-right text-[9px]">Return Signed Copy of Warrant to Supplier</p>
    </div>
  );
}
